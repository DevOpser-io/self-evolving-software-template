// Only load Capacitor in native app context
if (window.webkit?.messageHandlers?.bridge || window.AndroidBridge) {
    const script = document.createElement('script');
    script.src = 'https://unpkg.com/@capacitor/core@5.0.0/dist/capacitor.js';
    document.head.appendChild(script);
}
