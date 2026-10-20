#![cfg_attr(
  all(not(debug_assertions), target_os = "windows"),
  windows_subsystem = "windows"
)]

use tauri::{Manager, WindowBuilder, WindowUrl};

fn main() {
  tauri::Builder::default()
    .setup(|app| {
        let init_script = r#"
            // Provide a proxy window to prevent video players from crashing
            var originalOpen = window.open;
            window.open = function(url, name, features) {
                var proxy = new Proxy(window, {
                    get: function(target, prop) {
                        if (prop === 'closed') return false;
                        if (prop === 'close') return function(){};
                        if (prop === 'focus') return function(){};
                        if (prop === 'blur') return function(){};
                        if (prop === 'postMessage') return function(){};
                        if (typeof target[prop] === 'function') {
                            return function() {};
                        }
                        return target[prop];
                    }
                });
                return proxy;
            };

            // Intercept clicks on links that try to open in a new tab/window
            // We preventDefault to stop the ad, but DO NOT stopPropagation
            // so the underlying video player still receives the click!
            document.addEventListener('click', function(e) {
                var target = e.target;
                while (target && target.tagName !== 'A') {
                    target = target.parentNode;
                }
                if (target && target.target === '_blank') {
                    e.preventDefault();
                }
            }, true);
        "#;

        let remote_url = option_env!("VERT_APP_URL");
        let window_url = match remote_url {
            Some(url) => WindowUrl::External(url.parse()?),
            None => WindowUrl::App("index.html".into()),
        };

        WindowBuilder::new(
            app,
            "main",
            window_url
        )
        .title("Vert")
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .inner_size(1200.0, 800.0)
        .min_inner_size(800.0, 600.0)
        .resizable(true)
        .fullscreen(false)
        .decorations(remote_url.is_none())
        .transparent(false)
        .initialization_script(init_script)
        .build()?;

        Ok(())
    })
    .on_window_event(|event| {
        let window = event.window();
        if window.label() != "main" {
            let _ = window.close();
        }
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
