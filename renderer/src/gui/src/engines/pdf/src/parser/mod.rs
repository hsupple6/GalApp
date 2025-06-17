// src/engines/pdf/src/parser/mod.rs
pub mod content;  // New module for content stream parsing
pub mod font;     // Font-specific parsing
pub mod color;    // Color space parsing

use std::collections::HashMap;
use lopdf::{Document, Dictionary, Object, ObjectId};
use font::PDFFont;
use wasm_bindgen::JsValue;

#[derive(Debug)]
pub enum PDFError {
    DecompressionError(String),
    FontError(String),
    ParseError(String),
}

impl From<PDFError> for JsValue {
    fn from(error: PDFError) -> Self {
        JsValue::from_str(&format!("PDF Error: {:?}", error))
    }
}

impl From<lopdf::Error> for PDFError {
    fn from(error: lopdf::Error) -> Self {
        PDFError::ParseError(error.to_string())
    }
}

#[derive(Debug, Copy, Clone)]
pub enum FontType {
    Type1,
    TrueType,
    CIDFontType2,
    Type3,
}

pub struct PDFResources {
    fonts: HashMap<String, PDFFont>,
}

impl PDFResources {
    pub fn new(doc: &Document, resources: &Dictionary) -> Result<Self, PDFError> {
        let mut fonts = HashMap::new();
        
        if let Ok(font_dict) = resources.get(b"Font") {
            if let Object::Dictionary(dict) = font_dict {
                for (name, font_ref) in dict.iter() {
                    if let Object::Reference(ref_id) = font_ref {
                        if let Ok(font_dict) = doc.get_dictionary(*ref_id) {
                            let font = PDFFont::from_dictionary(doc, font_dict)?;
                            fonts.insert(String::from_utf8_lossy(name).into_owned(), font);
                        }
                    }
                }
            }
        }
        
        Ok(PDFResources { fonts })
    }

    pub fn get_font(&self, name: &str) -> Result<Option<&PDFFont>, PDFError> {
        Ok(self.fonts.get(name))
    }
}