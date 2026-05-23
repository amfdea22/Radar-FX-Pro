/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                trader: {
                    green: '#16A34A',
                    red: '#EF4444',
                    amber: '#F59E0B',
                    dark: '#1F2937',
                    blue: '#2563EB',
                    cyan: '#22D3EE',
                }
            }
        },
    },
    plugins: [],
}
