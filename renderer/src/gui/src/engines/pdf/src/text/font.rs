use freetype::{Library, Face};
use std::sync::Arc;

pub struct PDFFont {
    name: String,
    data: Arc<Vec<u8>>,
    face: Face,
    metrics: FontMetrics,
}

pub struct FontMetrics {
    ascent: f32,
    descent: f32,
    line_height: f32,
    units_per_em: i32,
}

pub struct GlyphBitmap {
    pub data: Vec<u8>,
    pub width: i32,
    pub height: i32,
    pub left: i32,
    pub top: i32,
}

impl PDFFont {
    pub fn new(name: String, data: Vec<u8>, ft_lib: &Library) -> Result<Self, freetype::Error> {
        let face = ft_lib.new_memory_face(data.clone(), 0)?;
        let metrics = FontMetrics {
            ascent: face.ascender() as f32,
            descent: face.descender() as f32,
            line_height: face.height() as f32,
            units_per_em: face.units_per_em(),
        };

        Ok(PDFFont {
            name,
            data: Arc::new(data),
            face,
            metrics,
        })
    }

    pub fn render_glyph(&self, c: char, size_px: u32) -> Result<GlyphBitmap, freetype::Error> {
        self.face.set_pixel_sizes(0, size_px)?;
        self.face.load_char(c as usize, freetype::face::LoadFlag::RENDER)?;
        
        let glyph = self.face.glyph();
        let bitmap = glyph.bitmap();
        
        Ok(GlyphBitmap {
            data: bitmap.buffer().to_vec(),
            width: bitmap.width(),
            height: bitmap.rows(),
            left: glyph.bitmap_left(),
            top: glyph.bitmap_top(),
        })
    }
} 
