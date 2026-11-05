# HospitalOS Mobile design system

## Visual direction
A modern clinical operations product with a midnight-navy foundation, controlled glass surfaces, cyan primary accent and violet secondary accent. The interface should be calm, legible and operationally focused.

## Foundations
- Background: #0B1220
- Elevated background: #101B2E
- Surface: translucent slate (#152238 at controlled opacity)
- Primary: #38BDF8
- Secondary: #A78BFA
- Text: #F8FAFC
- Muted text: #94A3B8
- Success: #34D399
- Warning: #FBBF24
- Danger: #FB7185

## Layout principles
- Optimize for one-hand Android use.
- Use a consistent spacing scale and 12–24 px corner radii.
- Keep tap targets at least 44–48 dp where possible.
- Maintain strong text contrast over blur and gradient surfaces.
- Use a small number of meaningful metrics; avoid dashboard clutter.
- Provide empty, loading, error and offline states for every data-driven screen.

## Motion
- Use transitions to communicate hierarchy and state changes.
- Use Reanimated for purposeful motion and gesture interactions.
- Provide reduced-motion alternatives.
- Reserve 3D for onboarding or non-critical visual moments. Never make a core clinical workflow depend on 3D rendering.

## Prototype data
All values in the first dashboard are synthetic placeholders and must never be interpreted as live hospital data.
