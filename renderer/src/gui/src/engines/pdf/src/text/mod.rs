use std::collections::HashMap;
use wasm_bindgen::prelude::*;
use web_sys::{WebGl2RenderingContext as GL, WebGlTexture};
use crate::parser::PDFError;

pub struct FontManager {
    texture: WebGlTexture,
    char_data: HashMap<char, GlyphData>,
    context: GL,
}

#[derive(Clone)]
struct GlyphData {
    x: f32,
    y: f32,
    width: f32,
    height: f32,
    advance: f32,
    tex_coords: [f32; 4],
}

impl FontManager {
    pub fn new(gl: &GL) -> Result<Self, JsValue> {
        let texture = gl.create_texture()
            .ok_or_else(|| JsValue::from_str("Failed to create texture"))?;
        
        gl.active_texture(GL::TEXTURE0);
        gl.bind_texture(GL::TEXTURE_2D, Some(&texture));
        
        let char_data = Self::create_char_data();
        
        Ok(FontManager {
            texture,
            char_data,
            context: gl.clone(),
        })
    }

    fn create_bitmap_font(gl: &GL) -> Result<WebGlTexture, JsValue> {
        let texture = gl.create_texture()
            .ok_or_else(|| JsValue::from_str("Failed to create texture"))?;
        
        gl.bind_texture(GL::TEXTURE_2D, Some(&texture));
        gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_MIN_FILTER, GL::NEAREST as i32);
        gl.tex_parameteri(GL::TEXTURE_2D, GL::TEXTURE_MAG_FILTER, GL::NEAREST as i32);
        
        // Create a 256x256 texture with 16x16 characters
        let width = 256;
        let height = 256;
        let mut data = vec![0u8; width * height];
        
        // Draw each ASCII character
        for c in ' '..='~' {
            let idx = (c as u8 - b' ') as usize;
            let x = (idx % 16) * 16;
            let y = (idx / 16) * 16;
            
            // Draw a simple character shape
            for dy in 2..14 {
                for dx in 2..14 {
                    data[(y + dy) * width + (x + dx)] = 255;
                }
            }
        }
        
        gl.tex_image_2d_with_i32_and_i32_and_i32_and_format_and_type_and_opt_u8_array(
            GL::TEXTURE_2D,
            0,
            GL::R8 as i32,
            width as i32,
            height as i32,
            0,
            GL::RED,
            GL::UNSIGNED_BYTE,
            Some(&data),
        )?;
        
        Ok(texture)
    }

    pub fn get_texture(&self) -> &WebGlTexture {
        &self.texture
    }

    fn create_char_data() -> HashMap<char, GlyphData> {
        let mut char_data = HashMap::new();
        let char_size = 16.0;  // Each character is 16x16 pixels
        let tex_size = 256.0;  // Texture is 256x256

        for c in ' '..='~' {
            let idx = (c as u8 - b' ') as usize;
            let x = (idx % 16) as f32 * char_size;
            let y = (idx / 16) as f32 * char_size;

            char_data.insert(c, GlyphData {
                x: x,
                y: y,
                width: 12.0,  // Slightly smaller than cell size
                height: 12.0,
                advance: 12.0,
                tex_coords: [
                    x / tex_size,
                    y / tex_size,
                    (x + char_size) / tex_size,
                    (y + char_size) / tex_size,
                ],
            });
        }

        char_data
    }

    pub fn get_text_vertices(&self, text: &str, x: f32, y: f32, size: f32, _font_name: &str) 
        -> Result<(Vec<f32>, Vec<f32>), PDFError> 
    {
        let mut vertices = Vec::new();
        let mut texcoords = Vec::new();
        let mut cursor_x = x;
        let scale = size / 12.0;  // Scale relative to our base size

        for c in text.chars() {
            if let Some(glyph) = self.char_data.get(&c) {
                // Calculate vertex positions
                let x0 = cursor_x;
                let y0 = y;
                let x1 = x0 + glyph.width * scale;
                let y1 = y0 + glyph.height * scale;

                // Add vertices
                vertices.extend_from_slice(&[
                    x0, y0,  // Top-left
                    x1, y0,  // Top-right
                    x0, y1,  // Bottom-left
                    x0, y1,  // Bottom-left
                    x1, y0,  // Top-right
                    x1, y1,  // Bottom-right
                ]);

                // Add texture coordinates
                let [s0, t0, s1, t1] = glyph.tex_coords;
                texcoords.extend_from_slice(&[
                    s0, t0,  // Top-left
                    s1, t0,  // Top-right
                    s0, t1,  // Bottom-left
                    s0, t1,  // Bottom-left
                    s1, t0,  // Top-right
                    s1, t1,  // Bottom-right
                ]);

                cursor_x += glyph.advance * scale;
            }
        }

        Ok((vertices, texcoords))
    }

    pub fn load_font(&mut self, name: String, data: Vec<u8>) -> Result<(), PDFError> {
        // For now, just return Ok since we're using our bitmap font
        Ok(())
    }
}
