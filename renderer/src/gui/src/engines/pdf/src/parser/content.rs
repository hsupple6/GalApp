use crate::content::{TextObject, VectorObject, PathCommand, Matrix};
use crate::text::FontManager;
use super::{PDFError, PDFResources};
use super::color::Color;
use lopdf::{Document, Object};

#[derive(Debug, Clone)]
pub enum Operator {
    BeginText,
    EndText,
    SetFont(String, f32),
    ShowText(String),
    ShowTextAdjusted(String),
    SetTextMatrix(f32, f32, f32, f32, f32, f32),
    SetCharSpacing(f32),
    SetWordSpacing(f32),
    SetHorizontalScaling(f32),
    SetLeading(f32),
    SetRenderingMode(TextRenderMode),
    SetLineWidth(f32),
    SetLineCap(LineCap),
    SetLineJoin(LineJoin),
    SetMiterLimit(f32),
    SetDashPattern(Vec<f32>, f32),
    SetStrokeColor(Color),
    SetFillColor(Color),
    MoveTo(f32, f32),
    LineTo(f32, f32),
    CurveTo(f32, f32, f32, f32, f32, f32),
    ClosePath,
    SaveState,
    RestoreState,
    SetGraphicsState(String),
}

#[derive(Debug, Clone)]
pub enum TextRenderMode {
    Fill,
    Stroke,
    FillAndStroke,
    Invisible,
    FillAndClip,
    StrokeAndClip,
    FillStrokeAndClip,
    Clip,
}

#[derive(Debug, Clone)]
pub enum LineCap {
    Butt,
    Round,
    Square,
}

#[derive(Debug, Clone)]
pub enum LineJoin {
    Miter,
    Round,
    Bevel,
}

pub struct ContentParser<'a> {
    data: &'a [u8],
    position: usize,
    graphics_state_stack: Vec<GraphicsState>,
    current_state: GraphicsState,
    font_manager: &'a mut FontManager,
    resources: &'a PDFResources,
}

#[derive(Debug, Clone)]
struct GraphicsState {
    font: Option<String>,
    font_size: f32,
    text_matrix: [f32; 6],
    stroke_color: Color,
    fill_color: Color,
}

impl GraphicsState {
    fn new() -> Self {
        GraphicsState {
            font: None,
            font_size: 12.0,
            text_matrix: [1.0, 0.0, 0.0, 1.0, 0.0, 0.0],
            stroke_color: Color::RGB(0.0, 0.0, 0.0),
            fill_color: Color::RGB(0.0, 0.0, 0.0),
        }
    }
}

impl<'a> ContentParser<'a> {
    pub fn new(
        data: &'a [u8], 
        font_manager: &'a mut FontManager, 
        resources: &'a PDFResources
    ) -> Self {
        ContentParser {
            data,
            position: 0,
            graphics_state_stack: Vec::new(),
            current_state: GraphicsState::new(),
            font_manager,
            resources,
        }
    }

    pub fn parse(&mut self) -> Option<(Vec<TextObject>, Vec<VectorObject>)> {
        let mut text_objects = Vec::new();
        let mut vector_objects = Vec::new();
        let mut current_path = Vec::new();
        let mut in_text_block = false;
        let mut text_matrix = Matrix::default();

        web_sys::console::log_1(&format!(
            "Starting to parse content stream of {} bytes", 
            self.data.len()
        ).into());

        // Print first few bytes for debugging
        let preview: String = self.data.iter()
            .take(50)
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<_>>()
            .join(" ");
        web_sys::console::log_1(&format!("Content stream starts with: {}", preview).into());

        while self.position < self.data.len() {
            let current_pos = self.position;
            match self.parse_next_operator() {
                Some(op) => {
                    web_sys::console::log_1(&format!(
                        "Parsed operator at position {}: {:?}", 
                        current_pos, op
                    ).into());
                    match op {
                        Operator::BeginText => {
                            in_text_block = true;
                            text_matrix = Matrix::default();
                        },
                        Operator::EndText => {
                            in_text_block = false;
                        },
                        Operator::SetFont(name, size) => {
                            self.current_state.font = Some(name);
                            self.current_state.font_size = size;
                        },
                        Operator::SetTextMatrix(a, b, c, d, e, f) => {
                            if in_text_block {
                                text_matrix = Matrix { a, b, c, d, e, f };
                            }
                        },
                        Operator::ShowText(text) | Operator::ShowTextAdjusted(text) => {
                            if !text.trim().is_empty() && in_text_block {
                                text_objects.push(TextObject {
                                    text: text.to_string(),
                                    x: text_matrix.e,
                                    y: text_matrix.f,
                                    font_size: self.current_state.font_size * text_matrix.a.abs(),
                                    font_name: self.current_state.font.clone().unwrap_or_else(|| "Default".to_string()),
                                });
                            }
                        },
                        Operator::MoveTo(x, y) => {
                            current_path.push(PathCommand::MoveTo(x, y));
                        },
                        Operator::LineTo(x, y) => {
                            current_path.push(PathCommand::LineTo(x, y));
                        },
                        Operator::CurveTo(x1, y1, x2, y2, x3, y3) => {
                            current_path.push(PathCommand::CurveTo(x1, y1, x2, y2, x3, y3));
                        },
                        Operator::ClosePath => {
                            current_path.push(PathCommand::Close);
                            // Create vector object
                            if !current_path.is_empty() {
                                let stroke_color = match self.current_state.stroke_color {
                                    Color::RGB(r, g, b) => [r, g, b, 1.0],
                                    _ => [0.0, 0.0, 0.0, 1.0],
                                };
                                let fill_color = match self.current_state.fill_color {
                                    Color::RGB(r, g, b) => Some([r, g, b, 1.0]),
                                    _ => None,
                                };
                                vector_objects.push(VectorObject {
                                    path_data: current_path.clone(),
                                    stroke_color,
                                    fill_color,
                                });
                                current_path.clear();
                            }
                        },
                        _ => {} // Handle other operators
                    }
                }
                None => {
                    // Log skipped bytes
                    let skipped = self.data[current_pos]
                        .to_string()
                        .chars()
                        .filter(|c| !c.is_control())
                        .collect::<String>();
                    web_sys::console::log_1(&format!(
                        "Failed to parse operator at position {}, byte: {:02x} ({})", 
                        current_pos, 
                        self.data[current_pos],
                        skipped
                    ).into());
                    self.advance();
                }
            }
        }

        web_sys::console::log_1(&format!(
            "Finished parsing content stream. Found {} text objects and {} vector objects",
            text_objects.len(),
            vector_objects.len()
        ).into());

        Some((text_objects, vector_objects))
    }

    fn parse_next_operator(&mut self) -> Option<Operator> {
        self.skip_whitespace();
        
        // Log the current position and next few bytes for debugging
        let preview: String = self.data[self.position..]
            .iter()
            .take(10)
            .map(|b| format!("{:02x}", b))
            .collect::<Vec<_>>()
            .join(" ");
        web_sys::console::log_1(&format!(
            "Parsing at position {}, next bytes: {}", 
            self.position, 
            preview
        ).into());

        match self.peek_byte()? {
            b'q' => {
                self.advance();
                Some(Operator::SaveState)
            },
            b'Q' => {
                self.advance();
                Some(Operator::RestoreState)
            },
            b'B' => self.parse_begin_text(),
            b'E' => self.parse_end_text(),
            b'T' => self.parse_text_operator(),
            b'(' => {
                if let Some(text) = self.parse_text_string() {
                    Some(Operator::ShowText(text))
                } else {
                    None
                }
            },
            b'[' => {
                if let Some(text) = self.parse_text_array() {
                    Some(Operator::ShowTextAdjusted(text))
                } else {
                    None
                }
            },
            b'/' => {
                // Font selection
                if let Some(name) = self.parse_name() {
                    self.skip_whitespace();
                    if let Some(size) = self.parse_number() {
                        return Some(Operator::SetFont(name, size));
                    }
                }
                None
            },
            b'm' => {
                self.advance();
                let x = self.parse_number()?;
                let y = self.parse_number()?;
                Some(Operator::MoveTo(x, y))
            },
            b'l' => {
                self.advance();
                let x = self.parse_number()?;
                let y = self.parse_number()?;
                Some(Operator::LineTo(x, y))
            },
            byte => {
                // Skip unknown operators but log them
                let mut operator = String::new();
                while let Some(b) = self.peek_byte() {
                    if b.is_ascii_whitespace() {
                        break;
                    }
                    operator.push(b as char);
                    self.advance();
                }
                web_sys::console::log_1(&format!(
                    "Unknown operator '{}' at position {}, byte: {:02x} ({})",
                    operator,
                    self.position - operator.len(),
                    byte,
                    byte as char
                ).into());
                None
            }
        }
    }

    fn parse_begin_text(&mut self) -> Option<Operator> {
        self.advance(); // Skip 'B'
        if self.peek_byte()? == b'T' {
            self.advance();
            Some(Operator::BeginText)
        } else {
            None
        }
    }

    fn parse_end_text(&mut self) -> Option<Operator> {
        self.advance(); // Skip 'E'
        if self.peek_byte()? == b'T' {
            self.advance();
            Some(Operator::EndText)
        } else {
            None
        }
    }

    fn parse_text_operator(&mut self) -> Option<Operator> {
        self.advance(); // Skip 'T'
        match self.peek_byte()? {
            b'm' => self.parse_text_matrix(),
            b'f' => {
                self.advance();
                let name = self.parse_name()?;
                let size = self.parse_number()?;
                Some(Operator::SetFont(name, size))
            },
            _ => None,
        }
    }

    fn parse_text_matrix(&mut self) -> Option<Operator> {
        self.advance(); // Skip 'm'
        self.skip_whitespace();
        
        let a = self.parse_number()?;
        let b = self.parse_number()?;
        let c = self.parse_number()?;
        let d = self.parse_number()?;
        let e = self.parse_number()?;
        let f = self.parse_number()?;
        
        Some(Operator::SetTextMatrix(a, b, c, d, e, f))
    }

    fn parse_text_string(&mut self) -> Option<String> {
        let mut text = String::new();
        if self.peek_byte()? != b'(' {
            return None;
        }
        self.advance(); // Skip '('
        
        let mut escaped = false;
        while let Some(b) = self.peek_byte() {
            self.advance();
            match b {
                b')' if !escaped => break,
                b'\\' if !escaped => escaped = true,
                _ => {
                    if escaped {
                        match b {
                            b'n' => text.push('\n'),
                            b'r' => text.push('\r'),
                            b't' => text.push('\t'),
                            b'(' => text.push('('),
                            b')' => text.push(')'),
                            b'\\' => text.push('\\'),
                            _ => text.push(b as char),
                        }
                        escaped = false;
                    } else {
                        text.push(b as char);
                    }
                }
            }
        }
        Some(text)
    }

    fn parse_text_array(&mut self) -> Option<String> {
        self.advance(); // Skip '['
        let mut text = String::new();
        
        while let Some(b) = self.peek_byte() {
            match b {
                b']' => {
                    self.advance();
                    break;
                },
                b'(' => {
                    if let Some(str_part) = self.parse_text_string() {
                        text.push_str(&str_part);
                    }
                },
                _ => {
                    self.advance();
                }
            }
        }
        
        Some(text)
    }

    fn parse_name(&mut self) -> Option<String> {
        if self.peek_byte()? != b'/' {
            return None;
        }
        self.advance(); // Skip '/'

        let mut name = String::new();
        while let Some(b) = self.peek_byte() {
            if b.is_ascii_whitespace() || b == b'[' || b == b']' || b == b'<' || b == b'>' {
                break;
            }
            name.push(b as char);
            self.advance();
        }

        Some(name)
    }

    fn parse_number(&mut self) -> Option<f32> {
        self.skip_whitespace();
        let start = self.position;
        let mut has_digit = false;
        let mut has_decimal = false;

        while let Some(b) = self.peek_byte() {
            match b {
                b'0'..=b'9' => {
                    has_digit = true;
                    self.advance();
                },
                b'.' if !has_decimal => {
                    has_decimal = true;
                    self.advance();
                },
                b'-' if self.position == start => {
                    self.advance();
                },
                _ if b.is_ascii_whitespace() || b == b']' => break,
                _ => {
                    if !has_digit {
                        return None;
                    }
                    break;
                }
            }
        }

        if !has_digit {
            return None;
        }

        let num_str = std::str::from_utf8(&self.data[start..self.position]).ok()?;
        num_str.parse().ok()
    }

    fn peek_byte(&self) -> Option<u8> {
        self.data.get(self.position).copied()
    }

    fn advance(&mut self) {
        self.position += 1;
    }

    fn skip_whitespace(&mut self) {
        while let Some(b) = self.peek_byte() {
            if !b.is_ascii_whitespace() && b != b'\0' {
                break;
            }
            self.advance();
        }
    }

    fn handle_save_state(&mut self) {
        self.graphics_state_stack.push(self.current_state.clone());
    }

    fn handle_restore_state(&mut self) -> Result<(), PDFError> {
        if let Some(state) = self.graphics_state_stack.pop() {
            self.current_state = state;
            Ok(())
        } else {
            Err(PDFError::ParseError("Graphics state stack underflow".into()))
        }
    }

    fn handle_set_font(&mut self, name: String, size: f32) -> Result<(), PDFError> {
        if let Some(font) = self.resources.get_font(&name)? {
            // Extract font data
            let font_data = font.get_font_data()?;
            
            // Load into font manager
            self.font_manager.load_font(
                name.clone(),
                font_data.to_vec(),
            )?;
            
            self.current_state.font = Some(name);
            self.current_state.font_size = size;
        }
        Ok(())
    }
} 