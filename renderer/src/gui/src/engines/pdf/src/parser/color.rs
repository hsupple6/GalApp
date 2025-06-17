#[derive(Debug, Clone)]
pub enum ColorSpace {
    DeviceRGB,
    DeviceCMYK,
    DeviceGray,
    Indexed { base: Box<ColorSpace>, lookup: Vec<u8> },
    Pattern,
}

#[derive(Debug, Clone)]
pub enum Color {
    RGB(f32, f32, f32),
    CMYK(f32, f32, f32, f32),
    Gray(f32),
} 