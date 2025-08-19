import { defineEcConfig } from 'astro-expressive-code'

export default defineEcConfig({
    themes: ['nord','material-theme-lighter'],
    styleOverrides: {
        // You can also override styles
        borderColor: "var(--border-color)",
        borderRadius: '0',
        frames: {
            frameBoxShadowCssValue: 'none',
        },
        codeFontFamily: "var(--font-mono)"
    },
    defaultProps: {
        // Enable word wrap by default
        wrap: true,
        // Disable wrapped line indentation for terminal languages
        overridesByLang: {
            'bash,ps,sh': { preserveIndent: false },
        },
    },
})