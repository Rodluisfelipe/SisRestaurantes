import { describe, expect, it } from 'vitest';
import { colorDeCategoria } from './coloresCategoria';

/**
 * El color de una categoría en el modo denso.
 *
 * Sin fotos, el color es lo único que queda para encontrar un producto de
 * reojo. Lo que se prueba aquí es que funcione con las cartas que existen, no
 * solo con la de una hamburguesería.
 */
describe('el color de una categoría', () => {
  it('reconoce las familias aunque el dueño escriba de más', () => {
    /* Nadie escribe "Hamburguesas" a secas: escribe "Hamburguesas
       Artesanales". Exigirle el nombre exacto sería un control que nunca
       acierta. */
    expect(colorDeCategoria('Hamburguesas Artesanales')).toContain('red');
    expect(colorDeCategoria('Bebidas Frías')).toContain('blue');
    expect(colorDeCategoria('Combos del día')).toContain('amber');
    expect(colorDeCategoria('Postres y Café')).toContain('purple');
  });

  it('no se pierde con tildes ni mayúsculas', () => {
    expect(colorDeCategoria('PROMOCIÓN')).toBe(colorDeCategoria('promocion'));
    expect(colorDeCategoria('Porción')).toBe(colorDeCategoria('porcion'));
  });

  it('una carta que no se parece a la de McDonald\'s también recibe color', () => {
    /* Un chino no tiene "hamburguesas" ni "postres": tiene "arroces" y
       "agridulces". Si lo no reconocido fuera todo del mismo gris, el modo
       denso no le serviría justo a quien más lo necesita. */
    const arroces = colorDeCategoria('Arroces');
    const agridulces = colorDeCategoria('Agridulces');

    expect(arroces).not.toContain('slate');
    expect(agridulces).not.toContain('slate');
    expect(arroces).not.toBe(agridulces);
  });

  it('la misma categoría tiene siempre el mismo color', () => {
    /* Es lo único que hace que el color sirva para encontrar algo. Uno al azar
       por render no valdría de nada. */
    expect(colorDeCategoria('Chop Suey')).toBe(colorDeCategoria('Chop Suey'));
  });

  it('un producto sin categoría cae en gris, que ahí sí es la respuesta', () => {
    expect(colorDeCategoria('')).toContain('slate');
    expect(colorDeCategoria('   ')).toContain('slate');
  });

  it('siempre trae fondo y color de texto', () => {
    /* Un fondo oscuro sin texto declarado hereda el del padre y puede quedar
       negro sobre negro. */
    for (const c of ['Hamburguesas', 'Bebidas', 'Arroces', '', 'Xyz']) {
      const clase = colorDeCategoria(c);
      expect(clase).toMatch(/bg-/);
      expect(clase).toMatch(/text-/);
    }
  });

  it('se lee en un turno de ocho horas: fondo claro, texto casi negro y una franja', () => {
    /* Bloques saturados con texto blanco cansan la vista y el blanco sobre
       amarillo no se leía. Pastel con texto -950 pasa AA de sobra. */
    for (const c of ['Hamburguesas', 'Bebidas', 'Combos', 'Postres', 'Arroces', 'Xyz', '']) {
      const clase = colorDeCategoria(c);
      expect(clase).not.toContain('text-white');
      expect(clase).toMatch(/bg-\w+-100/);
      expect(clase).toMatch(/text-\w+-(950|900)/);
      expect(clase).toContain('border-l-');
    }
  });
});
