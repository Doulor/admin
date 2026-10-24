//! 编译时把极客娘抠图转成盲文点阵字符画（SPEC §6 步骤 2），40 列宽，带每个字符格的平均颜色，
//! 终端用 truecolor 把它当彩色图打出来；不支持 truecolor 的终端只看得到字符本身，也还成形。
//! build.rs 只在构建机上跑（不会被交叉编译进目标产物），`image` 因此只是 [build-dependencies]。
//!
//! 来源优先级（SPEC §6）：app/web 里的正式素材存在就用它，否则退回仓库里委托方案阶段放的素材
//! （已经复制进 app/cli/assets/boot-mascot.webp，随仓库入库，交叉编译机也能看到）。两处都没有
//! 时不让构建失败——生成一个空字符画，`ui::login_anim` 那一步直接跳过，不影响登录本身。

use std::env;
use std::fs;
use std::path::{Path, PathBuf};

const COLS: usize = 40;
/// 盲文一个字符格是 2 列 × 4 行像素；画面按更瘦一点的 7:8 像素长宽比估算总高度，终端字符本身是长方形。
const CELL_W: u32 = 2;
const CELL_H: u32 = 4;

fn main() {
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").unwrap());
    let primary = manifest_dir.join("../web/sites/portal/assets/mascot/geek-girl.webp");
    let fallback = manifest_dir.join("assets/boot-mascot.webp");
    let source = if primary.is_file() {
        Some(primary)
    } else if fallback.is_file() {
        Some(fallback)
    } else {
        None
    };

    println!("cargo:rerun-if-changed=build.rs");
    if let Some(path) = &source {
        println!("cargo:rerun-if-changed={}", path.display());
    }

    let generated = source
        .as_deref()
        .and_then(render_braille)
        .unwrap_or_default();
    let out_dir = PathBuf::from(env::var("OUT_DIR").unwrap());
    fs::write(out_dir.join("mascot_braille.rs"), generated)
        .expect("write generated mascot_braille.rs");
}

/// 读图、按宽 40 字符格缩放、阈值化成盲文点阵，每格再带一个平均 RGB。失败（格式不支持、文件损坏）
/// 时返回 None，调用方落到空字符画，不让整个构建失败。
fn render_braille(path: &Path) -> Option<String> {
    let img = image::open(path).ok()?.to_rgba8();
    let (src_w, src_h) = img.dimensions();
    if src_w == 0 || src_h == 0 {
        return None;
    }

    let pixel_cols = COLS as u32 * CELL_W;
    // 终端字符本身比正方形高，缩放时把目标高度压扁一些，整体比例才不会被拉长。
    let aspect_correction = 0.55_f32;
    let pixel_rows = ((pixel_cols as f32) * (src_h as f32) / (src_w as f32) * aspect_correction)
        .round()
        .max(1.0) as u32;
    let resized = image::imageops::resize(
        &img,
        pixel_cols,
        pixel_rows,
        image::imageops::FilterType::Triangle,
    );

    let rows = pixel_rows.div_ceil(CELL_H);
    let mut cells: Vec<String> = Vec::new();

    // 盲文点阵的 8 个点按 Unicode 盲文块的位序排列：左列从上到下是 bit 0,1,2,6；右列是 bit 3,4,5,7。
    const DOT_BITS: [[u8; 2]; 4] = [[0, 3], [1, 4], [2, 5], [6, 7]];

    for row in 0..rows {
        for col in 0..COLS as u32 {
            let mut mask: u8 = 0;
            let mut sum = (0u32, 0u32, 0u32, 0u32); // r, g, b, 落在前景的点数
            for (dy, bits) in DOT_BITS.iter().enumerate() {
                for (dx, bit) in bits.iter().enumerate() {
                    let x = col * CELL_W + dx as u32;
                    let y = row * CELL_H + dy as u32;
                    if x >= pixel_cols || y >= pixel_rows {
                        continue;
                    }
                    let p = resized.get_pixel(x, y).0;
                    let (r, g, b, a) = (p[0] as u32, p[1] as u32, p[2] as u32, p[3] as u32);
                    // 透明或接近纯白背景都当底色，不点亮；其余按亮度过中点的算前景点。
                    let luma = (r * 30 + g * 59 + b * 11) / 100;
                    let foreground = a > 40 && !(luma > 235 && a < 250);
                    if foreground {
                        mask |= 1 << bit;
                        sum = (sum.0 + r, sum.1 + g, sum.2 + b, sum.3 + 1);
                    }
                }
            }
            if sum.3 > 0 {
                cells.push(format!(
                    "({:#06x}u32,{},{},{})",
                    0x2800 + mask as u32,
                    sum.0 / sum.3,
                    sum.1 / sum.3,
                    sum.2 / sum.3
                ));
            } else {
                cells.push(format!("({:#06x}u32,0,0,0)", 0x2800 + mask as u32));
            }
        }
    }

    let joined_cells = cells.join(",\n    ");
    Some(format!(
        "pub const MASCOT_COLS: usize = {COLS};\npub const MASCOT_ROWS: usize = {rows};\n/// (codepoint, r, g, b)，按行优先展开，长度 = MASCOT_COLS * MASCOT_ROWS。\npub const MASCOT_CELLS: &[(u32, u8, u8, u8)] = &[\n    {joined_cells}\n];\n",
    ))
}
