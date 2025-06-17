// src/engines/pdf/src/content/mod.rs
use lopdf::{Document, Object};
use crate::parser::{PDFResources, PDFError};
use crate::text::FontManager;
use crate::parser::content::ContentParser;
use wasm_bindgen::{JsCast, JsValue};
use web_sys::WebGl2RenderingContext as GL;
use flate2::read::ZlibDecoder;
use std::io::Read;

pub struct PDFContent {
    pub text_objects: Vec<TextObject>,
    pub vector_objects: Vec<VectorObject>,
    pub width: f32,
    pub height: f32,
    resources: PDFResources,
    content_stream: Vec<u8>,
}

pub struct TextObject {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub font_size: f32,
    pub font_name: String,
}

pub struct VectorObject {
    pub path_data: Vec<PathCommand>,
    pub stroke_color: [f32; 4],
    pub fill_color: Option<[f32; 4]>,
}

#[derive(Clone)]
pub enum PathCommand {
    MoveTo(f32, f32),
    LineTo(f32, f32),
    CurveTo(f32, f32, f32, f32, f32, f32),
    Close,
}

pub struct Matrix {
    pub a: f32,
    pub b: f32,
    pub c: f32,
    pub d: f32,
    pub e: f32,
    pub f: f32,
}

impl Default for Matrix {
    fn default() -> Self {
        Matrix {
            a: 1.0, b: 0.0,
            c: 0.0, d: 1.0,
            e: 0.0, f: 0.0,
        }
    }
}

impl PDFContent {
    fn decompress_stream(data: &[u8]) -> Option<Vec<u8>> {
        let mut decoder = ZlibDecoder::new(data);
        let mut decompressed = Vec::new();
        match decoder.read_to_end(&mut decompressed) {
            Ok(_) => {
                web_sys::console::log_1(&format!(
                    "Successfully decompressed stream from {} to {} bytes",
                    data.len(),
                    decompressed.len()
                ).into());
                Some(decompressed)
            },
            Err(e) => {
                web_sys::console::log_1(&format!("Failed to decompress stream: {}", e).into());
                None
            }
        }
    }

    pub fn from_page(doc: &Document, page_num: u32) -> Option<Self> {
        web_sys::console::log_1(&format!("Attempting to get page {}", page_num).into());
        
        // Get page reference from pages map
        let pages = doc.get_pages();
        let page_id = pages.get(&page_num)?;
        web_sys::console::log_1(&format!("Found page ID: {:?}", page_id).into());
        
        // Get page dictionary
        if let Ok(page_dict) = doc.get_dictionary(*page_id) {
            web_sys::console::log_1(&"Got page dictionary".into());
            web_sys::console::log_1(&format!("Page dictionary contents: {:?}", page_dict).into());
            
            // Get page resources - try different ways
            let resources_dict = match page_dict.get(b"Resources").ok()? {
                Object::Reference(id) => {
                    web_sys::console::log_1(&format!("Resources is a reference: {:?}", id).into());
                    doc.get_dictionary(*id).ok()?
                },
                Object::Dictionary(dict) => {
                    web_sys::console::log_1(&"Resources is a direct dictionary".into());
                    dict
                },
                other => {
                    web_sys::console::log_1(&format!("Resources has unexpected type: {:?}", other).into());
                    return None;
                }
            };
            
            let resources = PDFResources::new(doc, resources_dict).ok()?;
            
            // Get page contents - handle both single stream and array of streams
            let contents = match page_dict.get(b"Contents").ok()? {
                Object::Reference(id) => {
                    if let Ok(Object::Stream(stream)) = doc.get_object(*id) {
                        // Check if stream is compressed
                        if let Ok(filter) = stream.filter() {
                            if filter.as_str() == "FlateDecode" {
                                Self::decompress_stream(&stream.content)?
                            } else {
                                web_sys::console::log_1(&format!("Unknown filter: {}", filter).into());
                                stream.content.clone()
                            }
                        } else {
                            stream.content.clone()
                        }
                    } else {
                        web_sys::console::log_1(&"Contents reference is not a stream".into());
                        return None;
                    }
                },
                Object::Array(arr) => {
                    // Concatenate multiple content streams
                    let mut combined = Vec::new();
                    for item in arr {
                        if let Object::Reference(id) = item {
                            if let Ok(Object::Stream(stream)) = doc.get_object(*id) {
                                let content = if let Ok(filter) = stream.filter() {
                                    if filter.as_str() == "FlateDecode" {
                                        Self::decompress_stream(&stream.content)?
                                    } else {
                                        web_sys::console::log_1(&format!("Unknown filter: {}", filter).into());
                                        stream.content.clone()
                                    }
                                } else {
                                    stream.content.clone()
                                };
                                combined.extend_from_slice(&content);
                            }
                        }
                    }
                    combined
                },
                other => {
                    web_sys::console::log_1(&format!("Contents has unexpected type: {:?}", other).into());
                    return None;
                }
            };
            
            // Print a preview of the content stream
            let preview = String::from_utf8_lossy(&contents[..contents.len().min(100)]);
            web_sys::console::log_1(&format!("Content stream preview: {}", preview).into());
            
            // Get page dimensions from MediaBox
            let media_box = match page_dict.get(b"MediaBox").ok()? {
                Object::Array(arr) => arr,
                other => {
                    web_sys::console::log_1(&format!("MediaBox has unexpected type: {:?}", other).into());
                    return None;
                }
            };
            
            let get_num = |idx: usize| -> Option<f32> {
                match &media_box[idx] {
                    Object::Integer(n) => Some(*n as f32),
                    Object::Real(n) => Some(*n),
                    other => {
                        web_sys::console::log_1(&format!("MediaBox value has unexpected type: {:?}", other).into());
                        None
                    }
                }
            };
            
            let width = get_num(2)? - get_num(0)?;
            let height = get_num(3)? - get_num(1)?;
            web_sys::console::log_1(&format!("Page dimensions: {}x{}", width, height).into());
            
            // Parse content stream
            let text_objects = Vec::new();
            let vector_objects = Vec::new();
            
            return Some(PDFContent {
                text_objects,
                vector_objects,
                width,
                height,
                resources,
                content_stream: contents,
            });
        } else {
            web_sys::console::log_1(&"Failed to get page dictionary".into());
        }
        None
    }

    pub fn get_resources(&self) -> Result<&PDFResources, JsValue> {
        Ok(&self.resources)
    }

    pub fn get_stream(&self) -> Result<&[u8], JsValue> {
        Ok(&self.content_stream)
    }
}