// src/engines/pdf/src/lib.rs
use wasm_bindgen::prelude::*;
use lopdf::Document;
use web_sys::console;
use std::panic;
use crate::parser::content::ContentParser;

mod content;
mod parser;
mod renderer;
mod text;
mod viewport;

pub use content::PDFContent;
use wasm_bindgen::prelude::*;

#[wasm_bindgen(start)]
pub fn start() {
    panic::set_hook(Box::new(console_error_panic_hook::hook));
}

#[wasm_bindgen]
pub struct PDFEngine {
    document: Option<Document>,
    current_page: u32,
    renderer: renderer::WebGLRenderer,
    viewport: viewport::ViewportManager,
}

#[wasm_bindgen]
impl PDFEngine {
    #[wasm_bindgen(constructor)]
    pub fn new(canvas_id: &str) -> Result<PDFEngine, JsValue> {
        console::log_1(&"Initializing PDF Engine".into());
        
        let renderer = renderer::WebGLRenderer::new(canvas_id)?;
        let viewport = viewport::ViewportManager::new();
        
        Ok(PDFEngine {
            viewport,
            renderer,
            document: None,
            current_page: 0,
        })
    }

    #[wasm_bindgen]
    pub fn load_document(&mut self, data: &[u8]) -> Result<(), JsValue> {
        match Document::load_from(data) {
            Ok(doc) => {
                console::log_1(&"PDF document loaded successfully".into());
                self.document = Some(doc);
                Ok(())
            }
            Err(e) => Err(JsValue::from_str(&format!("Failed to load PDF: {}", e)))
        }
    }

    #[wasm_bindgen]
    pub fn render_page(&mut self, page_num: u32, _transform: &[f32]) -> Result<(), JsValue> {
        if let Some(doc) = &self.document {
            match PDFContent::from_page(doc, page_num) {
                Some(mut content) => {
                    // Parse content stream with existing WebGL context
                    let resources = content.get_resources()?;
                    let stream = content.get_stream()?;
                    let mut parser = ContentParser::new(
                        stream,
                        self.renderer.get_font_manager_mut()?,
                        resources
                    );
                    
                    if let Some((text_objects, vector_objects)) = parser.parse() {
                        content.text_objects = text_objects;
                        content.vector_objects = vector_objects;
                    }

                    self.viewport.set_page_size(content.width, content.height);
                    let transform = self.viewport.get_transform_matrix();
                    self.renderer.render_page_content(&content, &transform)?;
                    self.current_page = page_num;
                    Ok(())
                }
                None => Err(JsValue::from_str("Failed to get page content"))
            }
        } else {
            Err(JsValue::from_str("No document loaded"))
        }
    }

    fn multiply_matrices(a: &[f32; 16], b: &[f32]) -> [f32; 16] {
        web_sys::console::log_1(&format!(
            "Multiplying matrices:\nA: {:?}\nB: {:?}",
            a, b
        ).into());

        let mut result = [0.0; 16];
        for i in 0..4 {
            for j in 0..4 {
                let mut sum = 0.0;
                for k in 0..4 {
                    sum += a[i * 4 + k] * b[k * 4 + j];
                }
                result[i * 4 + j] = sum;
            }
        }

        web_sys::console::log_1(&format!(
            "Result matrix: {:?}",
            result
        ).into());

        result
    }

    #[wasm_bindgen]
    pub fn get_page_count(&self) -> Result<u32, JsValue> {
        if let Some(doc) = &self.document {
            Ok(doc.get_pages().len() as u32)
        } else {
            Err(JsValue::from_str("No document loaded"))
        }
    }

    #[wasm_bindgen]
    pub fn get_current_page(&self) -> u32 {
        self.current_page
    }
}

impl Drop for PDFEngine {
    fn drop(&mut self) {
        // Clean up resources
        self.document = None;
    }
}