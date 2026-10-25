//! `geek login` 的终端动画（SPEC §6 步骤 1–4），关在自己的模块、behind 一个小 trait，方便单独打磨：
//! 步骤（一）truecolor 画四个渐变的 YUGC 字母；步骤（二）极客娘的盲文点阵（编译时生成，见 build.rs）；
//! 步骤（三）用户码的框配一个 spinner；步骤（四）确认后头像（kitty/iTerm 图像协议，不支持就用盲文头像）
//! 加「欢迎回来，<昵称>」。不是 TTY、设置了 `NO_COLOR`、或 `--json` 时一律不画，由 `pick()` 挑 `NullAnimation`。

use crate::ui::braille;
use crossterm::style::{Color, Print, ResetColor, SetForegroundColor};
use crossterm::{cursor, execute, terminal};
use std::io::{self, Write};

include!(concat!(env!("OUT_DIR"), "/mascot_braille.rs"));

pub trait LoginAnimation {
    fn show_letters(&mut self) -> io::Result<()>;
    fn show_mascot(&mut self) -> io::Result<()>;
    fn begin_waiting(&mut self, user_code: &str, verification_uri: &str) -> io::Result<()>;
    /// 轮询等待期间周期性调用，推进 spinner 一帧；不是 TTY 时什么都不做。
    fn spin(&mut self) -> io::Result<()>;
    fn end_waiting(&mut self) -> io::Result<()>;
    fn show_welcome(&mut self, nickname: &str, avatar: Option<&[u8]>) -> io::Result<()>;
}

/// `--json`、非 TTY、`NO_COLOR`、`CI` 下用它：什么都不画，命令的其余输出不受影响。
pub struct NullAnimation;
impl LoginAnimation for NullAnimation {
    fn show_letters(&mut self) -> io::Result<()> {
        Ok(())
    }
    fn show_mascot(&mut self) -> io::Result<()> {
        Ok(())
    }
    fn begin_waiting(&mut self, _user_code: &str, _verification_uri: &str) -> io::Result<()> {
        Ok(())
    }
    fn spin(&mut self) -> io::Result<()> {
        Ok(())
    }
    fn end_waiting(&mut self) -> io::Result<()> {
        Ok(())
    }
    fn show_welcome(&mut self, _nickname: &str, _avatar: Option<&[u8]>) -> io::Result<()> {
        Ok(())
    }
}

const SPINNER_FRAMES: [char; 10] = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

pub struct TerminalAnimation {
    out: io::Stderr,
    spinner_frame: usize,
    waiting_lines: u16,
}

impl TerminalAnimation {
    pub fn new() -> Self {
        Self {
            out: io::stderr(),
            spinner_frame: 0,
            waiting_lines: 0,
        }
    }
}

impl Default for TerminalAnimation {
    fn default() -> Self {
        Self::new()
    }
}

/// 4 个字母的渐变色（SPEC §1 视觉令牌）：亮面 / 主体 / 描边三段，这里只取主体色画大字。
const LETTER_COLORS: [(char, (u8, u8, u8)); 4] = [
    ('Y', (0x3f, 0xd0, 0xa5)),
    ('U', (0x4a, 0xa6, 0xff)),
    ('G', (0xff, 0x83, 0xbb)),
    ('C', (0x8b, 0x93, 0xff)),
];

/// 5x5 的方块字，够在终端里认出字母形状就行，不追求真实字体。
const GLYPHS: [[&str; 5]; 4] = [
    ["█...█", ".█.█.", "..█..", "..█..", "..█.."], // Y
    ["█...█", "█...█", "█...█", "█...█", ".███."], // U
    [".████", "█....", "█.██.", "█...█", ".███."], // G
    [".████", "█....", "█....", "█....", ".████"], // C
];

impl LoginAnimation for TerminalAnimation {
    // 5 个字符格高的字母要按「每一行，横着挨个画 4 个字母」的顺序打印，行号在 GLYPHS 和
    // LETTER_COLORS 之间共用，不是单纯的下标遍历，clippy 的 needless_range_loop 建议套用不了。
    #[allow(clippy::needless_range_loop)]
    fn show_letters(&mut self) -> io::Result<()> {
        for row in 0..5 {
            for (col, (_letter, (r, g, b))) in LETTER_COLORS.iter().enumerate() {
                let glyph = GLYPHS[col][row];
                let painted: String = glyph.replace('.', " ");
                execute!(
                    self.out,
                    SetForegroundColor(Color::Rgb {
                        r: *r,
                        g: *g,
                        b: *b
                    }),
                    Print(&painted),
                    ResetColor,
                    Print("  ")
                )?;
            }
            execute!(self.out, Print("\n"))?;
        }
        execute!(self.out, Print("\n"))
    }

    fn show_mascot(&mut self) -> io::Result<()> {
        if MASCOT_CELLS.is_empty() {
            return Ok(());
        }
        for row in 0..MASCOT_ROWS {
            for col in 0..MASCOT_COLS {
                let (codepoint, r, g, b) = MASCOT_CELLS[row * MASCOT_COLS + col];
                let ch = char::from_u32(codepoint).unwrap_or(' ');
                if r == 0 && g == 0 && b == 0 && ch == '\u{2800}' {
                    execute!(self.out, Print(' '))?;
                } else {
                    execute!(
                        self.out,
                        SetForegroundColor(Color::Rgb { r, g, b }),
                        Print(ch),
                        ResetColor
                    )?;
                }
            }
            execute!(self.out, Print("\n"))?;
        }
        execute!(self.out, Print("\n"))
    }

    fn begin_waiting(&mut self, user_code: &str, verification_uri: &str) -> io::Result<()> {
        let [top, code, uri, bottom] = waiting_box(user_code, verification_uri);
        execute!(
            self.out,
            Print(format!("{top}\n")),
            Print(format!("{code}\n")),
            Print(format!("{uri}\n")),
            Print(format!("{bottom}\n")),
            Print(format!("{} 等待确认…\n", SPINNER_FRAMES[0])),
        )?;
        self.waiting_lines = 5;
        self.spinner_frame = 0;
        self.out.flush()
    }

    fn spin(&mut self) -> io::Result<()> {
        self.spinner_frame = (self.spinner_frame + 1) % SPINNER_FRAMES.len();
        execute!(
            self.out,
            cursor::MoveUp(1),
            terminal::Clear(terminal::ClearType::CurrentLine),
            Print(format!(
                "{} 等待确认…\n",
                SPINNER_FRAMES[self.spinner_frame]
            )),
        )?;
        self.out.flush()
    }

    fn end_waiting(&mut self) -> io::Result<()> {
        if self.waiting_lines == 0 {
            return Ok(());
        }
        execute!(
            self.out,
            cursor::MoveUp(1),
            terminal::Clear(terminal::ClearType::CurrentLine)
        )?;
        self.waiting_lines = 0;
        Ok(())
    }

    fn show_welcome(&mut self, nickname: &str, avatar: Option<&[u8]>) -> io::Result<()> {
        if let Some(bytes) = avatar {
            if let Ok(image) = image::load_from_memory(bytes) {
                if !render_inline_image(&mut self.out, bytes).unwrap_or(false) {
                    print_braille_avatar(&mut self.out, &image.to_rgba8())?;
                }
            }
        }
        execute!(self.out, Print(format!("欢迎回来，{nickname}\n")))
    }
}

/// 终端是 kitty 或 iTerm2 时，用它们各自的内联图像协议直接显示原图；返回 Ok(true) 表示已经画出来，
/// Ok(false)/Err 表示这个终端不支持，调用方该落到盲文头像。
fn render_inline_image(out: &mut impl Write, png_or_similar: &[u8]) -> io::Result<bool> {
    use base64_lite::encode;
    if std::env::var_os("KITTY_WINDOW_ID").is_some()
        || std::env::var("TERM").is_ok_and(|t| t.contains("kitty"))
    {
        let payload = encode(png_or_similar);
        write!(out, "\x1b_Ga=T,f=100,t=d;{payload}\x1b\\")?;
        out.flush()?;
        return Ok(true);
    }
    if std::env::var("TERM_PROGRAM").is_ok_and(|program| program == "iTerm.app") {
        let payload = encode(png_or_similar);
        write!(
            out,
            "\x1b]1337;File=inline=1;size={}:{payload}\x07",
            png_or_similar.len()
        )?;
        out.flush()?;
        return Ok(true);
    }
    Ok(false)
}

fn print_braille_avatar(out: &mut impl Write, img: &image::RgbaImage) -> io::Result<()> {
    for row in braille::render(img, 20) {
        for cell in row {
            if let Some((r, g, b)) = cell.rgb {
                execute!(
                    out,
                    SetForegroundColor(Color::Rgb { r, g, b }),
                    Print(cell.ch),
                    ResetColor
                )?;
            } else {
                execute!(out, Print(' '))?;
            }
        }
        execute!(out, Print("\n"))?;
    }
    Ok(())
}

/// 不想为了一张头像引入完整的 base64 crate，这里自己写标准 base64（无填充要求，RFC 4648 §4，带填充）。
mod base64_lite {
    const TABLE: &[u8; 64] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

    pub fn encode(input: &[u8]) -> String {
        let mut out = String::with_capacity(input.len().div_ceil(3) * 4);
        for chunk in input.chunks(3) {
            let b0 = chunk[0];
            let b1 = *chunk.get(1).unwrap_or(&0);
            let b2 = *chunk.get(2).unwrap_or(&0);
            out.push(TABLE[(b0 >> 2) as usize] as char);
            out.push(TABLE[(((b0 & 0x03) << 4) | (b1 >> 4)) as usize] as char);
            out.push(if chunk.len() > 1 {
                TABLE[(((b1 & 0x0f) << 2) | (b2 >> 6)) as usize] as char
            } else {
                '='
            });
            out.push(if chunk.len() > 2 {
                TABLE[(b2 & 0x3f) as usize] as char
            } else {
                '='
            });
        }
        out
    }

    #[cfg(test)]
    mod tests {
        use super::encode;
        #[test]
        fn matches_known_vectors() {
            assert_eq!(encode(b""), "");
            assert_eq!(encode(b"f"), "Zg==");
            assert_eq!(encode(b"fo"), "Zm8=");
            assert_eq!(encode(b"foo"), "Zm9v");
            assert_eq!(encode(b"foobar"), "Zm9vYmFy");
        }
    }
}

/// 终端里一个字符占几列：东亚宽字符和全角符号占 2 列，其余 1 列。提示框只要求对得齐，不去覆盖全部 Unicode。
fn display_width(text: &str) -> usize {
    text.chars()
        .map(|c| match c as u32 {
            0x1100..=0x115F
            | 0x2E80..=0xA4CF
            | 0xAC00..=0xD7A3
            | 0xF900..=0xFAFF
            | 0xFE30..=0xFE6F
            | 0xFF00..=0xFF60
            | 0xFFE0..=0xFFE6
            | 0x20000..=0x3FFFD => 2,
            _ => 1,
        })
        .sum()
}

/// 等待确认时的提示框四行（不含换行）：边框宽度按两行内容的显示宽度算，网址再长也对齐。
fn waiting_box(user_code: &str, verification_uri: &str) -> [String; 4] {
    const CODE_LABEL: &str = "用户码：";
    const URI_LABEL: &str = "在浏览器打开 ";
    // 两条竖线之间：一个前导空格 + 标签 + 内容 + 补齐的空格，最长的一行末尾留一个空格。
    let used = |label: &str, content: &str| 1 + display_width(label) + display_width(content);
    let inner = used(CODE_LABEL, user_code).max(used(URI_LABEL, verification_uri)) + 1;
    let line = |label: &str, content: &str| {
        format!(
            "│ {label}{content}{}│",
            " ".repeat(inner - used(label, content))
        )
    };
    let border = "─".repeat(inner);
    [
        format!("┌{border}┐"),
        line(CODE_LABEL, user_code),
        line(URI_LABEL, verification_uri),
        format!("└{border}┘"),
    ]
}

/// `--json`、非 TTY、`NO_COLOR`、`CI` 下给 `NullAnimation`，否则给真的终端动画。
pub fn pick(interactive: bool) -> Box<dyn LoginAnimation> {
    if interactive {
        Box::new(TerminalAnimation::new())
    } else {
        Box::new(NullAnimation)
    }
}

#[cfg(test)]
mod waiting_box_tests {
    use super::{display_width, waiting_box};

    fn widths(user_code: &str, uri: &str) -> Vec<usize> {
        waiting_box(user_code, uri)
            .iter()
            .map(|line| display_width(line))
            .collect()
    }

    #[test]
    fn every_line_has_the_same_width_for_a_long_preview_url() {
        // 预发布验收时的真实输入：网址比用户码长得多，旧实现的网址行比边框宽 10 列。
        let w = widths("VTHJ-LSBL", "https://prev.yangtzeu.work/device");
        assert!(w.iter().all(|n| *n == w[0]), "{w:?}");
    }

    #[test]
    fn every_line_has_the_same_width_when_the_code_is_the_longer_part() {
        let w = widths("ABCDEFGH-IJKLMNOP-QRSTUVWX", "http://x/d");
        assert!(w.iter().all(|n| *n == w[0]), "{w:?}");
    }

    #[test]
    fn wide_characters_in_the_content_count_two_columns() {
        assert_eq!(display_width("用户码："), 8);
        let w = widths("AB", "https://例子.中国/device");
        assert!(w.iter().all(|n| *n == w[0]), "{w:?}");
    }

    #[test]
    fn the_box_keeps_both_values_intact() {
        let lines = waiting_box("VTHJ-LSBL", "https://prev.yangtzeu.work/device");
        assert!(lines[1].contains("VTHJ-LSBL"));
        assert!(lines[2].contains("https://prev.yangtzeu.work/device"));
    }
}
