module.exports = {
  content: [
    './src/**/*.{tsx,ts,jsx,js,html}',
    './index.html'
  ],
  theme: {
    extend: {
      colors: {
        primary: 'var(--color-primary)',
        danger: 'var(--color-danger)',
        warning: 'var(--color-warning)',
        success: 'var(--color-success)',
        white: '#fff',
      },
      // Add any custom utilities if needed
    },
  },
  plugins: [],
}
