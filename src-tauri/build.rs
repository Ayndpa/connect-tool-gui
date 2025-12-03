fn main() {
    std::env::set_var("PROTOC", protoc_bin_vendored::protoc_bin_path().unwrap());
    tonic_build::configure()
        .type_attribute(".", "#[derive(serde::Serialize, serde::Deserialize)]")
        .compile_protos(&["../connect_tool.proto"], &["../"])
        .unwrap();

    // 配置 Tauri 构建，使用自定义清单文件以请求管理员权限
    tauri_build::try_build(
        tauri_build::Attributes::new().windows_attributes(
            tauri_build::WindowsAttributes::new().app_manifest(include_str!("app.manifest"))
        )
    ).expect("failed to build tauri app");
}
