mod shaders; 

use wasm_bindgen::prelude::*;
use web_sys::{
    WebGl2RenderingContext as GL,
    WebGlProgram,
    WebGlShader,
    WebGlBuffer,
    WebGlVertexArrayObject,
    HtmlCanvasElement,
};
use crate::{
    content::{PDFContent, TextObject, VectorObject, PathCommand},
    text::FontManager,
    viewport::ViewportManager,
};

pub struct WebGLRenderer {
    context: GL,
    text_program: WebGlProgram,
    path_program: WebGlProgram,
    image_program: WebGlProgram,
    vertex_array: WebGlVertexArrayObject,
    vertex_buffer: WebGlBuffer,
    texcoord_buffer: WebGlBuffer,
    font_manager: FontManager,
    state_manager: RenderStateManager,
    viewport_manager: ViewportManager,
}

struct RenderStateManager {
    current_program: Option<WebGlProgram>,
    blend_enabled: bool,
    current_texture: Option<u32>,
    viewport: [i32; 4],
    scissor: Option<[i32; 4]>,
}

impl RenderStateManager {
    fn new() -> Self {
        RenderStateManager {
            current_program: None,
            blend_enabled: false,
            current_texture: None,
            viewport: [0, 0, 0, 0],
            scissor: None,
        }
    }
}

fn compile_shader(gl: &GL, shader_type: u32, source: &str) -> Result<WebGlShader, JsValue> {
    let shader = gl.create_shader(shader_type)
        .ok_or_else(|| String::from("Unable to create shader object"))?;
    gl.shader_source(&shader, source);
    gl.compile_shader(&shader);

    if gl.get_shader_parameter(&shader, GL::COMPILE_STATUS)
        .as_bool()
        .unwrap_or(false)
    {
        Ok(shader)
    } else {
        Err(JsValue::from_str(&gl.get_shader_info_log(&shader)
            .unwrap_or_else(|| String::from("Unknown error creating shader"))))
    }
}

impl WebGLRenderer {
    pub fn new(canvas_id: &str) -> Result<Self, JsValue> {
        let context = Self::initialize_context(canvas_id)?;
        let text_program = Self::create_program(&context, shaders::TEXT_VERTEX_SHADER, shaders::TEXT_FRAGMENT_SHADER)?;
        let path_program = Self::create_program(&context, shaders::PATH_VERTEX_SHADER, shaders::PATH_FRAGMENT_SHADER)?;
        let image_program = Self::create_program(&context, shaders::IMAGE_VERTEX_SHADER, shaders::IMAGE_FRAGMENT_SHADER)?;
        
        let vertex_array = context.create_vertex_array()
            .ok_or_else(|| JsValue::from_str("Failed to create vertex array"))?;
        let vertex_buffer = context.create_buffer()
            .ok_or_else(|| JsValue::from_str("Failed to create vertex buffer"))?;
        let texcoord_buffer = context.create_buffer()
            .ok_or_else(|| JsValue::from_str("Failed to create texcoord buffer"))?;
        
        let font_manager = FontManager::new(&context)?;
        
        Ok(WebGLRenderer {
            context,
            text_program,
            path_program,
            image_program,
            vertex_array,
            vertex_buffer,
            texcoord_buffer,
            font_manager,
            state_manager: RenderStateManager::new(),
            viewport_manager: ViewportManager::new(),
        })
    }

    pub fn render_page_content(&mut self, content: &PDFContent, transform: &[f32; 16]) -> Result<(), JsValue> {
        let gl = &self.context;
        
        // Clear to white
        gl.clear_color(1.0, 1.0, 1.0, 1.0);
        gl.clear(GL::COLOR_BUFFER_BIT);

        // Draw a simple red triangle in the middle of the screen
        gl.use_program(Some(&self.text_program));
        
        let vertices = vec![
            0.0,  0.5,  // Top
           -0.5, -0.5,  // Bottom left
            0.5, -0.5,  // Bottom right
        ];

        gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.vertex_buffer));
        gl.buffer_data_with_array_buffer_view(
            GL::ARRAY_BUFFER,
            &js_sys::Float32Array::from(&vertices[..]),
            GL::STATIC_DRAW,
        );

        let pos_loc = gl.get_attrib_location(&self.text_program, "position") as u32;
        gl.enable_vertex_attrib_array(pos_loc);
        gl.vertex_attrib_pointer_with_i32(pos_loc, 2, GL::FLOAT, false, 0, 0);

        gl.draw_arrays(GL::TRIANGLES, 0, 3);

        Ok(())
    }

    fn initialize_context(canvas_id: &str) -> Result<GL, JsValue> {
        let window = web_sys::window().unwrap();
        let document = window.document().unwrap();
        let canvas = document
            .get_element_by_id(canvas_id)
            .unwrap()
            .dyn_into::<HtmlCanvasElement>()?;

        Ok(canvas
            .get_context("webgl2")?
            .unwrap()
            .dyn_into::<GL>()?)
    }

    fn create_program(gl: &GL, vert_source: &str, frag_source: &str) -> Result<WebGlProgram, JsValue> {
        let vert_shader = compile_shader(gl, GL::VERTEX_SHADER, vert_source)?;
        let frag_shader = compile_shader(gl, GL::FRAGMENT_SHADER, frag_source)?;
        let program = gl.create_program().ok_or("Unable to create shader program")?;
        
        gl.attach_shader(&program, &vert_shader);
        gl.attach_shader(&program, &frag_shader);
        gl.link_program(&program);

        if !gl.get_program_parameter(&program, GL::LINK_STATUS).as_bool().unwrap_or(false) {
            return Err(JsValue::from_str(&format!(
                "Failed to link shader program: {}",
                gl.get_program_info_log(&program).unwrap_or_default()
            )));
        }
        
        Ok(program)
    }

    fn setup_text_attributes(&self) -> Result<(), JsValue> {
        let gl = &self.context;
        
        // Position attribute
        let pos_loc = gl.get_attrib_location(&self.text_program, "position") as u32;
        gl.enable_vertex_attrib_array(pos_loc);
        gl.vertex_attrib_pointer_with_i32(pos_loc, 2, GL::FLOAT, false, 0, 0);
        
        // Texcoord attribute
        let tex_loc = gl.get_attrib_location(&self.text_program, "texcoord") as u32;
        gl.enable_vertex_attrib_array(tex_loc);
        gl.vertex_attrib_pointer_with_i32(tex_loc, 2, GL::FLOAT, false, 0, 0);
        
        Ok(())
    }
    
    fn render_text_objects(&mut self, objects: &[TextObject], transform: &[f32; 16]) -> Result<(), JsValue> {
        let gl = &self.context;

        // Set up text rendering state
        gl.use_program(Some(&self.text_program));

        // Set transform uniform
        let transform_loc = gl.get_uniform_location(&self.text_program, "transform");
        gl.uniform_matrix4fv_with_f32_array(transform_loc.as_ref(), false, transform);

        // Bind texture
        gl.active_texture(GL::TEXTURE0);
        gl.bind_texture(GL::TEXTURE_2D, Some(&self.font_manager.get_texture()));
        let tex_uniform = gl.get_uniform_location(&self.text_program, "u_texture");
        gl.uniform1i(tex_uniform.as_ref(), 0);

        // Enable vertex attributes
        let pos_loc = gl.get_attrib_location(&self.text_program, "position") as u32;
        let tex_loc = gl.get_attrib_location(&self.text_program, "texcoord") as u32;
        gl.enable_vertex_attrib_array(pos_loc);
        gl.enable_vertex_attrib_array(tex_loc);

        // Enable blending
        gl.enable(GL::BLEND);
        gl.blend_func(GL::SRC_ALPHA, GL::ONE_MINUS_SRC_ALPHA);

        // Render each text object
        for text_obj in objects {
            let (vertices, texcoords) = self.font_manager.get_text_vertices(
                &text_obj.text,
                text_obj.x,
                text_obj.y,
                text_obj.font_size,
                &text_obj.font_name
            ).map_err(|e| JsValue::from(e))?;

            // Upload vertex data
            gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.vertex_buffer));
            gl.buffer_data_with_array_buffer_view(
                GL::ARRAY_BUFFER,
                &js_sys::Float32Array::from(&vertices[..]),
                GL::DYNAMIC_DRAW,
            );
            gl.vertex_attrib_pointer_with_i32(pos_loc, 2, GL::FLOAT, false, 0, 0);

            // Upload texture coordinates
            gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.texcoord_buffer));
            gl.buffer_data_with_array_buffer_view(
                GL::ARRAY_BUFFER,
                &js_sys::Float32Array::from(&texcoords[..]),
                GL::DYNAMIC_DRAW,
            );
            gl.vertex_attrib_pointer_with_i32(tex_loc, 2, GL::FLOAT, false, 0, 0);

            // Draw
            gl.draw_arrays(GL::TRIANGLES, 0, (vertices.len() / 2) as i32);
        }

        // Cleanup
        gl.disable_vertex_attrib_array(pos_loc);
        gl.disable_vertex_attrib_array(tex_loc);
        gl.disable(GL::BLEND);

        Ok(())
    }

    fn render_vector_objects(&mut self, objects: &[VectorObject], transform: &[f32; 16]) -> Result<(), JsValue> {
        let gl = &self.context;
        
        // Set up path rendering state
        gl.use_program(Some(&self.path_program));
        gl.uniform_matrix4fv_with_f32_array(
            gl.get_uniform_location(&self.path_program, "transform").as_ref(),
            false,
            transform
        );
        
        // Set up vertex attributes
        self.setup_path_attributes()?;
        
        // Enable blending for transparency
        gl.enable(GL::BLEND);
        gl.blend_func(GL::SRC_ALPHA, GL::ONE_MINUS_SRC_ALPHA);
        
        // Render each vector object
        for obj in objects {
            // Set color uniforms
            self.set_color_uniforms(&obj.stroke_color, &obj.fill_color)?;
            
            // Generate and upload path geometry
            let vertices = self.tessellate_path(&obj.path_data);
            gl.bind_buffer(GL::ARRAY_BUFFER, Some(&self.vertex_buffer));
            gl.buffer_data_with_array_buffer_view(
                GL::ARRAY_BUFFER,
                &js_sys::Float32Array::from(&vertices[..]),
                GL::DYNAMIC_DRAW,
            );
            
            // Draw
            gl.draw_arrays(GL::TRIANGLE_STRIP, 0, (vertices.len() / 2) as i32);
        }
        
        Ok(())
    }

    fn set_color_uniforms(&self, stroke: &[f32; 4], fill: &Option<[f32; 4]>) -> Result<(), JsValue> {
        let gl = &self.context;
        
        if let Some(loc) = gl.get_uniform_location(&self.path_program, "stroke_color") {
            gl.uniform4fv_with_f32_array(Some(&loc), stroke);
        }
        
        if let Some(loc) = gl.get_uniform_location(&self.path_program, "fill_color") {
            if let Some(fill_color) = fill {
                gl.uniform4fv_with_f32_array(Some(&loc), fill_color);
            }
        }
        
        Ok(())
    }

    fn tessellate_path(&self, path_data: &[PathCommand]) -> Vec<f32> {
        let mut vertices = Vec::new();
        let mut current_x = 0.0;
        let mut current_y = 0.0;

        for cmd in path_data {
            match cmd {
                PathCommand::MoveTo(x, y) => {
                    current_x = *x;
                    current_y = *y;
                    vertices.extend_from_slice(&[current_x, current_y]);
                },
                PathCommand::LineTo(x, y) => {
                    current_x = *x;
                    current_y = *y;
                    vertices.extend_from_slice(&[current_x, current_y]);
                },
                PathCommand::CurveTo(x1, y1, x2, y2, x3, y3) => {
                    // Simple curve tessellation - add control points
                    vertices.extend_from_slice(&[*x1, *y1, *x2, *y2, *x3, *y3]);
                    current_x = *x3;
                    current_y = *y3;
                },
                PathCommand::Close => {
                    // Add first vertex to close the path
                    if !vertices.is_empty() {
                        vertices.extend_from_slice(&[vertices[0], vertices[1]]);
                    }
                }
            }
        }
        vertices
    }

    fn setup_path_attributes(&self) -> Result<(), JsValue> {
        let gl = &self.context;
        
        // Position attribute
        let pos_loc = gl.get_attrib_location(&self.path_program, "position") as u32;
        gl.enable_vertex_attrib_array(pos_loc);
        gl.vertex_attrib_pointer_with_i32(pos_loc, 2, GL::FLOAT, false, 0, 0);
        
        Ok(())
    }

    pub fn get_font_manager_mut(&mut self) -> Result<&mut FontManager, JsValue> {
        Ok(&mut self.font_manager)
    }
}

impl Drop for WebGLRenderer {
    fn drop(&mut self) {
        let gl = &self.context;
        gl.delete_program(Some(&self.text_program));
        gl.delete_program(Some(&self.path_program));
        gl.delete_program(Some(&self.image_program));
        gl.delete_vertex_array(Some(&self.vertex_array));
        gl.delete_buffer(Some(&self.vertex_buffer));
        gl.delete_buffer(Some(&self.texcoord_buffer));
    }
}