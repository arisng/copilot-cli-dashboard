import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        gh: {
          bg: '#0d1117',
          surface: '#161b22',
          border: '#30363d',
          text: '#e6edf3',
          muted: '#8b949e',
          accent: '#58a6ff',
          attention: '#f85149',
          active: '#3fb950',
          warning: '#d29922',
          vscode: '#a371f7',
        },
      },
      fontFamily: {
        sans: ['JetBrains Mono', 'ui-monospace', 'monospace'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'monospace'],
      },
    },
  },
  safelist: [
    // Mode badge + border classes — dynamically selected based on session.currentMode
    'border-green-400/30', 'text-green-400', 'bg-green-400/5',
    'border-sky-400/30',   'text-sky-400',   'bg-sky-400/5',
    'border-gray-500/30',  'text-gray-400',  'bg-gray-400/5',
  ],
  plugins: [],
};

export default config;
