/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        residential: "#1f6f54", // 住宅=緑
        commercial: "#b45309", // 商業=琥珀
        policy: "#4338ca", // 施策=藍
      },
    },
  },
  plugins: [],
};
