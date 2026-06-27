use serde::{Deserialize, Serialize};
use std::path::Path;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::ipc::Channel;

/// Rust 端返回的音频元数据
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AudioMetadata {
    pub title: String,
    pub artist: String,
    pub album: String,
    pub duration_secs: f64,
    pub file_name: String,
}

/// 从本地音频文件解析真实 ID3/Vorbis/FLAC 元数据
#[tauri::command]
pub fn read_audio_metadata(file_path: String) -> Result<AudioMetadata, String> {
    let path = Path::new(&file_path);
    if !path.exists() {
        return Err(format!("文件不存在: {}", file_path));
    }

    let tagged_file = lofty::read_from_path(path).map_err(|e| {
        format!("无法读取音频元数据: {} ({})", e, file_path)
    })?;

    let properties = tagged_file.properties();
    let duration_secs = properties.duration().as_secs_f64();

    // 尝试从 tag 获取 title/artist/album
    let title = tagged_file
        .primary_tag()
        .and_then(|t| t.title().map(|s| s.to_string()))
        .or_else(|| {
            tagged_file
                .first_tag()
                .and_then(|t| t.title().map(|s| s.to_string()))
        })
        .unwrap_or_default();

    let artist = tagged_file
        .primary_tag()
        .and_then(|t| t.artist().map(|s| s.to_string()))
        .or_else(|| {
            tagged_file
                .first_tag()
                .and_then(|t| t.artist().map(|s| s.to_string()))
        })
        .unwrap_or_default();

    let album = tagged_file
        .primary_tag()
        .and_then(|t| t.album().map(|s| s.to_string()))
        .or_else(|| {
            tagged_file
                .first_tag()
                .and_then(|t| t.album().map(|s| s.to_string()))
        })
        .unwrap_or_default();

    let file_name = path
        .file_name()
        .map(|s| s.to_string_lossy().to_string())
        .unwrap_or_default();

    Ok(AudioMetadata {
        title,
        artist,
        album,
        duration_secs,
        file_name,
    })
}

/// 带进度回调的文件下载命令
#[tauri::command]
pub async fn download_file(
    url: String,
    dest_path: String,
    on_progress: Channel<f64>,
) -> Result<(), String> {
    let response = reqwest::get(&url)
        .await
        .map_err(|e| format!("下载请求失败: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("服务器返回状态码: {}", response.status()));
    }

    let total_size = response.content_length().unwrap_or(0);
    let downloaded = Arc::new(AtomicU64::new(0));

    // 创建目标文件的父目录
    if let Some(parent) = Path::new(&dest_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| format!("创建目录失败: {}", e))?;
    }

    let mut file = std::fs::File::create(&dest_path)
        .map_err(|e| format!("创建文件失败: {}", e))?;

    let mut stream = response.bytes_stream();
    use futures_util::StreamExt;
    use std::io::Write;
    use tokio_util::io::AsyncWriteExt;

    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("下载流错误: {}", e))?;
        file.write_all(&chunk)
            .map_err(|e| format!("写入文件失败: {}", e))?;
        file.flush().map_err(|e| format!("flush 失败: {}", e))?;

        if total_size > 0 {
            let bytes_downloaded = downloaded.fetch_add(chunk.len() as u64, Ordering::Relaxed) + chunk.len() as u64;
            let progress = (bytes_downloaded as f64 / total_size as f64) * 100.0;
            let _ = on_progress.invoke(progress);
        }
    }

    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            read_audio_metadata,
            download_file,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
