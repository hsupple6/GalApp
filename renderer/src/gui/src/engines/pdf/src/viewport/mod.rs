// src/engines/pdf/src/viewport/mod.rs
use std::f32::consts::PI;

pub struct ViewportManager {
    scale: f32,
    offset_x: f32,
    offset_y: f32,
    rotation: f32,  // In radians
    page_width: f32,
    page_height: f32,
    canvas_width: f32,
    canvas_height: f32,
}

impl ViewportManager {
    pub fn new() -> Self {
        ViewportManager {
            scale: 1.0,
            offset_x: 0.0,
            offset_y: 0.0,
            rotation: 0.0,
            page_width: 612.0,  // Default US Letter
            page_height: 792.0,
            canvas_width: 800.0,
            canvas_height: 1000.0,
        }
    }

    pub fn set_page_size(&mut self, width: f32, height: f32) {
        self.page_width = width;
        self.page_height = height;
    }

    pub fn update(&mut self, scale: f32, x: f32, y: f32) {
        self.scale = scale.max(0.25).min(4.0);
        self.offset_x = x;
        self.offset_y = y;
    }

    pub fn rotate(&mut self, angle_degrees: f32) {
        self.rotation = angle_degrees * PI / 180.0;
    }

    pub fn set_canvas_size(&mut self, width: f32, height: f32) {
        self.canvas_width = width;
        self.canvas_height = height;
    }

    pub fn get_transform_matrix(&self) -> [f32; 16] {
        // Convert PDF points to normalized device coordinates
        let scale_x = 2.0 / self.page_width;
        let scale_y = 2.0 / self.page_height;

        web_sys::console::log_1(&format!(
            "PDF size: {}x{}, scale: {}x{}", 
            self.page_width, self.page_height,
            scale_x, scale_y
        ).into());

        // Move origin to top-left and flip Y axis
        [
            scale_x,  0.0,     0.0, 0.0,  // Scale X
            0.0,    -scale_y,  0.0, 0.0,  // Scale Y (flipped)
            0.0,     0.0,      1.0, 0.0,  // No Z scale
            -1.0,    1.0,      0.0, 1.0,  // Move to top-left
        ]
    }
}