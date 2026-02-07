/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./App.{js,jsx,ts,tsx}", "./src/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        border: "hsl(40, 15%, 88%)",
        input: "hsl(40, 15%, 88%)",
        ring: "hsl(18, 75%, 55%)",
        background: "hsl(40, 20%, 97%)",
        foreground: "hsl(24, 10%, 10%)",
        primary: {
          DEFAULT: "hsl(18, 75%, 55%)",
          foreground: "hsl(60, 9%, 98%)",
        },
        secondary: {
          DEFAULT: "hsl(40, 20%, 94%)",
          foreground: "hsl(24, 10%, 10%)",
        },
        destructive: {
          DEFAULT: "hsl(0, 84%, 60%)",
          foreground: "hsl(60, 9%, 98%)",
        },
        muted: {
          DEFAULT: "hsl(40, 20%, 94%)",
          foreground: "hsl(25, 5%, 45%)",
        },
        accent: {
          DEFAULT: "hsl(40, 20%, 90%)",
          foreground: "hsl(24, 10%, 10%)",
        },
        popover: {
          DEFAULT: "hsl(0, 0%, 100%)",
          foreground: "hsl(24, 10%, 10%)",
        },
        card: {
          DEFAULT: "hsl(0, 0%, 100%)",
          foreground: "hsl(24, 10%, 10%)",
        },
      },
      borderRadius: {
        lg: "12px",
        md: "10px",
        sm: "8px",
      },
      fontFamily: {
        sans: ["Quicksand_400Regular"],
        serif: ["YoungSerif_400Regular"],
      },
    },
  },
  plugins: [],
};
