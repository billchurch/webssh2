// app/routes/templates/error-page.ts
// Pure function for generating HTML error pages

export interface ErrorPageData {
  title: string
  message: string
  host: string
  port: number
  showRetry?: boolean
}

/**
 * Render a styled HTML error page for browser clients
 */
export const renderErrorPage = (data: ErrorPageData): string => {
  const { title, message, host, port, showRetry = false } = data

  const retryButton = showRetry
    ? `<a href="/ssh/host/${encodeURIComponent(host)}?port=${port}" class="button primary">Try Again</a>`
    : ''

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>WebSSH2 - ${escapeHtml(title)}</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e0e0e0;
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .error-container {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 40px;
      max-width: 500px;
      width: 100%;
      text-align: center;
      backdrop-filter: blur(10px);
    }

    .error-icon {
      font-size: 64px;
      margin-bottom: 20px;
    }

    h1 {
      font-size: 24px;
      font-weight: 600;
      color: #ff6b6b;
      margin-bottom: 16px;
    }

    .message {
      font-size: 16px;
      color: #b0b0b0;
      margin-bottom: 24px;
      line-height: 1.5;
      word-break: break-word;
    }

    .details {
      background: rgba(0, 0, 0, 0.2);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 24px;
      font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
      font-size: 14px;
    }

    .details-row {
      display: flex;
      justify-content: space-between;
      padding: 4px 0;
    }

    .details-label {
      color: #888;
    }

    .details-value {
      color: #4ecdc4;
    }

    .buttons {
      display: flex;
      gap: 12px;
      justify-content: center;
      flex-wrap: wrap;
    }

    .button {
      display: inline-block;
      padding: 12px 24px;
      border-radius: 6px;
      text-decoration: none;
      font-weight: 500;
      font-size: 14px;
      transition: all 0.2s ease;
    }

    .button.primary {
      background: #4ecdc4;
      color: #1a1a2e;
    }

    .button.primary:hover {
      background: #45b7aa;
      transform: translateY(-1px);
    }

    @media (max-width: 480px) {
      .error-container {
        padding: 24px;
      }

      .buttons {
        flex-direction: column;
      }

      .button {
        width: 100%;
      }
    }
  </style>
</head>
<body>
  <div class="error-container">
    <div class="error-icon">&#9888;</div>
    <h1>${escapeHtml(title)}</h1>
    <p class="message">${escapeHtml(message)}</p>
    <div class="details">
      <div class="details-row">
        <span class="details-label">Host:</span>
        <span class="details-value">${escapeHtml(host)}</span>
      </div>
      <div class="details-row">
        <span class="details-label">Port:</span>
        <span class="details-value">${String(port)}</span>
      </div>
    </div>
    <div class="buttons">
      ${retryButton}
    </div>
  </div>
</body>
</html>`
}

/**
 * Escape HTML special characters to prevent XSS
 */
const escapeHtml = (str: string): string => {
  return str.replaceAll(/[&<>"']/g, (char) => {
    switch (char) {
      case '&':
        return '&amp;'
      case '<':
        return '&lt;'
      case '>':
        return '&gt;'
      case '"':
        return '&quot;'
      case "'":
        return '&#39;'
      default:
        return char
    }
  })
}
