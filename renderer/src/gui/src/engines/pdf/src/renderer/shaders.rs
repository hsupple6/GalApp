// src/engines/pdf/src/renderer/shaders.rs

// Text rendering shaders
pub const TEXT_VERTEX_SHADER: &str = r#"#version 300 es
in vec2 position;
in vec2 texcoord;
uniform mat4 transform;

out vec2 v_texcoord;

void main() {
    gl_Position = transform * vec4(position, 0.0, 1.0);
    v_texcoord = texcoord;
}
"#;

pub const TEXT_FRAGMENT_SHADER: &str = r#"#version 300 es
precision highp float;

in vec2 v_texcoord;
uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
    // Debug: Show position in red/green
    fragColor = vec4(1.0, 0.0, 0.0, 1.0);  // Solid red to see anything
}
"#;

// Path rendering shaders
pub const PATH_VERTEX_SHADER: &str = r#"#version 300 es
in vec2 position;
uniform mat4 transform;

void main() {
    gl_Position = transform * vec4(position, 0.0, 1.0);
}
"#;

pub const PATH_FRAGMENT_SHADER: &str = r#"#version 300 es
precision mediump float;

uniform vec4 stroke_color;
uniform vec4 fill_color;

out vec4 fragColor;

void main() {
    // For now, just use stroke color
    fragColor = stroke_color;
}
"#;

// Image rendering shaders
pub const IMAGE_VERTEX_SHADER: &str = r#"#version 300 es
in vec2 position;
in vec2 texcoord;
uniform mat4 transform;

out vec2 v_texcoord;

void main() {
    gl_Position = transform * vec4(position, 0.0, 1.0);
    v_texcoord = texcoord;
}
"#;

pub const IMAGE_FRAGMENT_SHADER: &str = r#"#version 300 es
precision mediump float;

in vec2 v_texcoord;
uniform sampler2D u_texture;

out vec4 fragColor;

void main() {
    fragColor = texture(u_texture, v_texcoord);
}
"#;