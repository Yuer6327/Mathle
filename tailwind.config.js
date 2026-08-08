/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        wgreen: '#6aaa64',
        wyellow: '#c9b458',
        wgray: '#787c7e',
        wgreenDark: '#4a6a3f',
        wyellowDark: '#8a7a3a',
        wgrayDark: '#3a3a3c'
      },
      animation: {
        'flip': 'flip 0.6s ease forwards',
        'pop': 'pop 0.15s ease',
        'shake': 'shake 0.4s ease'
      },
      keyframes: {
        flip: {
          '0%': { transform: 'rotateX(0)' },
          '50%': { transform: 'rotateX(90deg)' },
          '100%': { transform: 'rotateX(0)' }
        },
        pop: {
          '0%': { transform: 'scale(0.8)' },
          '100%': { transform: 'scale(1)' }
        },
        shake: {
          '0%,100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-6px)' },
          '75%': { transform: 'translateX(6px)' }
        }
      }
    }
  }
}
