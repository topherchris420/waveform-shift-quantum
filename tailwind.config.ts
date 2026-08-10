import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import palette from "tailwindcss/colors";

/**
 * Paper Lab retheme.
 *
 * The lab UI was authored against Tailwind's dark ramps (slate-950 surfaces,
 * cyan-400 accents). Rather than rewrite thousands of utility classes, we
 * invert the lightness of each numeric ramp so the same semantics — "950 is
 * the surface, 400 is the accent ink" — now resolve to a warm paper/ink
 * editorial palette.
 */
const RAMP_KEYS = ["50", "100", "200", "300", "400", "500", "600", "700", "800", "900", "950"] as const;

const invertRamp = (ramp: Record<string, string>) => {
  const out: Record<string, string> = {};
  RAMP_KEYS.forEach((key, index) => {
    const mirrored = RAMP_KEYS[RAMP_KEYS.length - 1 - index];
    if (ramp[mirrored]) out[key] = ramp[mirrored];
  });
  return out;
};

/** Warm paper -> ink ramp, authored dark-first then mirrored below. */
const INK = {
  "50": "#faf9f6",
  "100": "#f5f3ee",
  "200": "#ebe7de",
  "300": "#dcd6c9",
  "400": "#bdb5a4",
  "500": "#948b79",
  "600": "#6f6759",
  "700": "#4d4740",
  "800": "#33302b",
  "900": "#1c1a17",
  "950": "#0d0d0d",
};

/** Plot-accent teal ramp anchored on #0ea5b7. */
const PLOT = {
  "50": "#eefbfc",
  "100": "#d3f4f7",
  "200": "#ade9ef",
  "300": "#74d7e2",
  "400": "#33bccd",
  "500": "#0ea5b7",
  "600": "#0a8396",
  "700": "#0d6a7a",
  "800": "#125764",
  "900": "#144955",
  "950": "#06303a",
};

const paperRamps = {
  slate: invertRamp(INK),
  gray: invertRamp(INK),
  zinc: invertRamp(INK),
  neutral: invertRamp(INK),
  stone: invertRamp(INK),
  cyan: invertRamp(PLOT),
  sky: invertRamp(PLOT),
  teal: invertRamp(PLOT),
  blue: invertRamp(palette.blue as Record<string, string>),
  indigo: invertRamp(palette.indigo as Record<string, string>),
  emerald: invertRamp(palette.emerald as Record<string, string>),
  green: invertRamp(palette.green as Record<string, string>),
  amber: invertRamp(palette.amber as Record<string, string>),
  yellow: invertRamp(palette.yellow as Record<string, string>),
  orange: invertRamp(palette.orange as Record<string, string>),
  red: invertRamp(palette.red as Record<string, string>),
  rose: invertRamp(palette.rose as Record<string, string>),
  fuchsia: invertRamp(palette.fuchsia as Record<string, string>),
  purple: invertRamp(palette.purple as Record<string, string>),
};

export default {
	darkMode: ["class"],
	content: [
		"./pages/**/*.{ts,tsx}",
		"./components/**/*.{ts,tsx}",
		"./app/**/*.{ts,tsx}",
		"./src/**/*.{ts,tsx}",
	],
	prefix: "",
	theme: {
		container: {
			center: true,
			padding: '2rem',
			screens: {
				'2xl': '1400px'
			}
		},
		extend: {
			fontFamily: {
				sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				display: ['Syne', 'ui-sans-serif', 'system-ui', 'sans-serif'],
				mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
			},
			colors: {
				...paperRamps,
				white: INK['950'],
				black: INK['100'],
				border: 'hsl(var(--border))',
				input: 'hsl(var(--input))',
				ring: 'hsl(var(--ring))',
				background: 'hsl(var(--background))',
				foreground: 'hsl(var(--foreground))',
				primary: {
					DEFAULT: 'hsl(var(--primary))',
					foreground: 'hsl(var(--primary-foreground))'
				},
				secondary: {
					DEFAULT: 'hsl(var(--secondary))',
					foreground: 'hsl(var(--secondary-foreground))'
				},
				destructive: {
					DEFAULT: 'hsl(var(--destructive))',
					foreground: 'hsl(var(--destructive-foreground))'
				},
				muted: {
					DEFAULT: 'hsl(var(--muted))',
					foreground: 'hsl(var(--muted-foreground))'
				},
				accent: {
					DEFAULT: 'hsl(var(--accent))',
					foreground: 'hsl(var(--accent-foreground))'
				},
				popover: {
					DEFAULT: 'hsl(var(--popover))',
					foreground: 'hsl(var(--popover-foreground))'
				},
				card: {
					DEFAULT: 'hsl(var(--card))',
					foreground: 'hsl(var(--card-foreground))'
				},
				quantum: {
					field: 'hsl(var(--quantum-field))',
					glow: 'hsl(var(--quantum-glow))',
					wave: 'hsl(var(--quantum-wave))',
					entangle: 'hsl(var(--quantum-entangle))',
					collapse: 'hsl(var(--quantum-collapse))'
				},
				copper: {
					DEFAULT: 'hsl(var(--copper))',
					foreground: 'hsl(var(--copper-foreground))'
				},
				lime: {
					DEFAULT: 'hsl(var(--lime))',
					foreground: 'hsl(var(--lime-foreground))'
				},
				violet: {
					DEFAULT: 'hsl(var(--violet))',
					foreground: 'hsl(var(--violet-foreground))'
				}
			},
			borderRadius: {
				lg: 'var(--radius)',
				md: 'calc(var(--radius) - 2px)',
				sm: 'calc(var(--radius) - 4px)'
			},
			keyframes: {
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				}
			},
			animation: {
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				'quantum-pulse': 'quantum-pulse 2s ease-in-out infinite',
				'wave-oscillate': 'wave-oscillate 1.5s ease-in-out infinite',
				'teleport-collapse': 'teleport-collapse 0.8s ease-in-out',
				'teleport-emerge': 'teleport-emerge 0.8s ease-in-out',
				'entanglement-link': 'entanglement-link 3s linear infinite'
			}
		}
	},
	plugins: [tailwindcssAnimate],
} satisfies Config;
