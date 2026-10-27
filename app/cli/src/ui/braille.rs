//! 运行时把任意 RGBA 图片（登录成功后拉到的头像）转成盲文点阵，终端不支持 kitty/iTerm 图像协议
//! 时的退路（SPEC §6 步骤 4）。算法和 build.rs 里给极客娘生成点阵用的是同一套（build.rs 在编译时跑，
//! 没法复用这个二进制 crate 的模块，所以各自有一份，逻辑保持一致即可）。

use image::RgbaImage;

const CELL_W: u32 = 2;
const CELL_H: u32 = 4;
const DOT_BITS: [[u8; 2]; 4] = [[0, 3], [1, 4], [2, 5], [6, 7]];

/// 一个字符格：盲文字符本身，加这个格子里前景像素的平均颜色（给 truecolor 终端上色）。
pub struct Cell {
    pub ch: char,
    pub rgb: Option<(u8, u8, u8)>,
}

/// 按 `cols` 个字符格宽把图片缩放、阈值化成盲文点阵；`cols` 为 0 或图片为空时返回空。
pub fn render(img: &RgbaImage, cols: usize) -> Vec<Vec<Cell>> {
    let (src_w, src_h) = img.dimensions();
    if cols == 0 || src_w == 0 || src_h == 0 {
        return Vec::new();
    }
    let pixel_cols = cols as u32 * CELL_W;
    let pixel_rows = ((pixel_cols as f32) * (src_h as f32) / (src_w as f32))
        .round()
        .max(1.0) as u32;
    let resized = image::imageops::resize(
        img,
        pixel_cols,
        pixel_rows,
        image::imageops::FilterType::Triangle,
    );
    let rows = pixel_rows.div_ceil(CELL_H);

    let mut grid = Vec::with_capacity(rows as usize);
    for row in 0..rows {
        let mut line = Vec::with_capacity(cols);
        for col in 0..cols as u32 {
            let mut mask: u8 = 0;
            let mut sum = (0u32, 0u32, 0u32, 0u32);
            for (dy, bits) in DOT_BITS.iter().enumerate() {
                for (dx, bit) in bits.iter().enumerate() {
                    let x = col * CELL_W + dx as u32;
                    let y = row * CELL_H + dy as u32;
                    if x >= pixel_cols || y >= pixel_rows {
                        continue;
                    }
                    let p = resized.get_pixel(x, y).0;
                    let (r, g, b, a) = (p[0] as u32, p[1] as u32, p[2] as u32, p[3] as u32);
                    let luma = (r * 30 + g * 59 + b * 11) / 100;
                    if a > 40 && !(luma > 235 && a < 250) {
                        mask |= 1 << bit;
                        sum = (sum.0 + r, sum.1 + g, sum.2 + b, sum.3 + 1);
                    }
                }
            }
            let ch = char::from_u32(0x2800 + mask as u32).unwrap_or(' ');
            let rgb = match (
                sum.0.checked_div(sum.3),
                sum.1.checked_div(sum.3),
                sum.2.checked_div(sum.3),
            ) {
                (Some(r), Some(g), Some(b)) => Some((r as u8, g as u8, b as u8)),
                _ => None,
            };
            line.push(Cell { ch, rgb });
        }
        grid.push(line);
    }
    grid
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::Rgba;

    #[test]
    fn renders_a_solid_square_as_fully_dotted_cells() {
        let mut img = RgbaImage::new(8, 8);
        for pixel in img.pixels_mut() {
            *pixel = Rgba([10, 20, 30, 255]);
        }
        let grid = render(&img, 4);
        assert_eq!(grid.len(), 2); // 8 像素高 / 4 = 2 行字符格
        assert_eq!(grid[0].len(), 4);
        assert_eq!(grid[0][0].ch, '\u{28ff}'); // 全部 8 个点都点亮
        assert_eq!(grid[0][0].rgb, Some((10, 20, 30)));
    }

    #[test]
    fn transparent_image_has_no_dots() {
        let img = RgbaImage::new(8, 8);
        let grid = render(&img, 4);
        assert!(grid
            .iter()
            .flatten()
            .all(|cell| cell.ch == '\u{2800}' && cell.rgb.is_none()));
    }

    #[test]
    fn zero_columns_or_empty_image_renders_nothing() {
        let img = RgbaImage::new(8, 8);
        assert!(render(&img, 0).is_empty());
        assert!(render(&RgbaImage::new(0, 0), 4).is_empty());
    }
}
