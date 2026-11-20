/**
 * Préparation de chaque fichier de test du navigateur (projet `browser` de Vitest).
 *
 * Styles réels de l'application : sans eux, une vérification de mise en page
 * (`page.viewport(800, 600)`, `toBeInViewport`) porte sur une page brute et ne prouve
 * rien. Les stories les ont déjà, par `.storybook/preview.ts` (LUN-145).
 */
import '@/styles/index.css'
