/**
 * Pruebas unitarias de las validaciones de formularios de login y registro del cliente
 * (src/utils/validation.js). Se ejecutan con el runner nativo de Node: `npm test`.
 */
import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
  isEmail,
  validateEmail,
  validateLogin,
  validateName,
  validatePassword,
  validateRegister,
} from '../src/utils/validation.js';

const validRegister = () => ({
  name: 'Ana Pérez',
  email: 'ana@ejemplo.com',
  password: 'Clave1234',
  confirm: 'Clave1234',
});

describe('isEmail', () => {
  test('acepta emails con formato válido', () => {
    for (const email of ['ana@ejemplo.com', 'ana.perez+gym@sub.ejemplo.com.ar', 'A@B.CO', 'x@y.zz']) {
      assert.equal(isEmail(email), true, email);
    }
  });

  test('acepta un email con espacios alrededor (se recorta)', () => {
    assert.equal(isEmail('  ana@ejemplo.com  '), true);
  });

  test('rechaza textos sin @, sin dominio o sin punto en el dominio', () => {
    for (const email of ['anaejemplo.com', 'ana@', '@ejemplo.com', 'ana@ejemplo', 'ana@ejemplo.']) {
      assert.equal(isEmail(email), false, email);
    }
  });

  test('rechaza emails con espacios en el medio o con dos @', () => {
    for (const email of ['ana perez@ejemplo.com', 'ana@ejem plo.com', 'ana@@ejemplo.com', 'a@b@c.com']) {
      assert.equal(isEmail(email), false, email);
    }
  });

  test('rechaza vacío, null, undefined y valores que no son texto', () => {
    for (const value of ['', '   ', null, undefined, 0, {}, []]) {
      assert.equal(isEmail(value), false, String(value));
    }
  });
});

describe('validateLogin', () => {
  test('datos válidos → sin errores', () => {
    assert.deepEqual(validateLogin({ email: 'atleta@macroentreno.com', password: 'Demo1234' }), {});
  });

  test('email con mayúsculas y espacios alrededor es válido', () => {
    assert.deepEqual(validateLogin({ email: '  ATLETA@MacroEntreno.com ', password: 'x' }), {});
  });

  test('email inválido → error en email', () => {
    assert.deepEqual(validateLogin({ email: 'atleta', password: 'Demo1234' }), { email: 'Ingresá un email válido' });
  });

  test('contraseña vacía → error en password', () => {
    assert.deepEqual(validateLogin({ email: 'atleta@macroentreno.com', password: '' }), {
      password: 'Ingresá tu contraseña',
    });
  });

  test('ambos campos vacíos → dos errores', () => {
    assert.deepEqual(validateLogin({ email: '', password: '' }), {
      email: 'Ingresá un email válido',
      password: 'Ingresá tu contraseña',
    });
  });

  test('campos ausentes (undefined) → dos errores', () => {
    assert.deepEqual(Object.keys(validateLogin({})).sort(), ['email', 'password']);
  });

  test('login no exige reglas de fortaleza: cualquier contraseña no vacía pasa', () => {
    assert.deepEqual(validateLogin({ email: 'a@b.com', password: '1' }), {});
  });
});

describe('validatePassword', () => {
  test('contraseña con letras y números de 8+ caracteres → null', () => {
    for (const pwd of ['Clave1234', 'abcdefg1', '1234567a', `${'a'.repeat(71)}1`]) {
      assert.equal(validatePassword(pwd), null, pwd);
    }
  });

  test('menos de 8 caracteres → "Mínimo 8 caracteres"', () => {
    assert.equal(validatePassword('Abc1234'), 'Mínimo 8 caracteres');
  });

  test('vacía o ausente → "Mínimo 8 caracteres"', () => {
    assert.equal(validatePassword(''), 'Mínimo 8 caracteres');
    assert.equal(validatePassword(undefined), 'Mínimo 8 caracteres');
    assert.equal(validatePassword(null), 'Mínimo 8 caracteres');
  });

  test('solo números → "Debe tener letras y números"', () => {
    assert.equal(validatePassword('12345678'), 'Debe tener letras y números');
  });

  test('solo letras → "Debe tener letras y números"', () => {
    assert.equal(validatePassword('SoloLetras'), 'Debe tener letras y números');
  });

  test('letras acentuadas o ñ no cuentan como letra (igual que el backend)', () => {
    assert.equal(validatePassword('ñáéíóú12'), 'Debe tener letras y números');
  });

  test('símbolos y espacios están permitidos si hay letra y número', () => {
    assert.equal(validatePassword('mi clave #1!'), null);
  });

  test('si es corta se informa primero el largo mínimo', () => {
    assert.equal(validatePassword('abc'), 'Mínimo 8 caracteres');
  });
});

describe('validateRegister', () => {
  test('datos válidos → sin errores', () => {
    assert.deepEqual(validateRegister(validRegister()), {});
  });

  test('nombre de menos de 2 caracteres → error en name', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), name: 'A' }), { name: 'Ingresá tu nombre' });
  });

  test('nombre de 2 caracteres es válido', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), name: 'Al' }), {});
  });

  test('nombre con solo espacios o 1 letra rodeada de espacios → error en name', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), name: '    ' }), { name: 'Ingresá tu nombre' });
    assert.deepEqual(validateRegister({ ...validRegister(), name: '  A  ' }), { name: 'Ingresá tu nombre' });
  });

  test('email inválido → error en email', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), email: 'ana@ejemplo' }), {
      email: 'Ingresá un email válido',
    });
  });

  test('contraseña corta → error en password', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), password: 'Ab1', confirm: 'Ab1' }), {
      password: 'Mínimo 8 caracteres',
    });
  });

  test('contraseña sin números → error en password', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), password: 'SoloLetras', confirm: 'SoloLetras' }), {
      password: 'Debe tener letras y números',
    });
  });

  test('confirmación distinta → error en confirm', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), confirm: 'Clave12345' }), {
      confirm: 'Las contraseñas no coinciden',
    });
  });

  test('la confirmación distingue mayúsculas y espacios', () => {
    assert.equal(validateRegister({ ...validRegister(), confirm: 'clave1234' }).confirm, 'Las contraseñas no coinciden');
    assert.equal(validateRegister({ ...validRegister(), confirm: 'Clave1234 ' }).confirm, 'Las contraseñas no coinciden');
  });

  test('confirmación vacía con contraseña válida → error en confirm', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), confirm: '' }), {
      confirm: 'Las contraseñas no coinciden',
    });
  });

  test('contraseña inválida y confirmación distinta → ambos errores', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), password: '123', confirm: '1234' }), {
      password: 'Mínimo 8 caracteres',
      confirm: 'Las contraseñas no coinciden',
    });
  });

  test('formulario vacío → errores en name, email y password (confirm coincide vacía)', () => {
    assert.deepEqual(validateRegister({ name: '', email: '', password: '', confirm: '' }), {
      name: 'Ingresá tu nombre',
      email: 'Ingresá un email válido',
      password: 'Mínimo 8 caracteres',
    });
  });

  test('todos los campos ausentes → errores en name, email y password', () => {
    assert.deepEqual(Object.keys(validateRegister({})).sort(), ['email', 'name', 'password']);
  });

  test('todos los campos inválidos a la vez → cuatro errores', () => {
    assert.deepEqual(Object.keys(validateRegister({ name: 'A', email: 'x', password: 'abc', confirm: 'abd' })).sort(), [
      'confirm',
      'email',
      'name',
      'password',
    ]);
  });

  test('no modifica el objeto recibido', () => {
    const form = validRegister();
    const copy = { ...form };
    validateRegister(form);
    assert.deepEqual(form, copy);
  });

  test('contraseña de más de 72 caracteres se rechaza en el cliente (igual que el backend)', () => {
    const long = `${'a'.repeat(80)}1`;
    assert.deepEqual(validateRegister({ ...validRegister(), password: long, confirm: long }), {
      password: 'Máximo 72 caracteres',
    });
  });
});

describe('seguridad: intentos de saltear la validación del cliente', () => {
  test('email con extensión de una sola letra se rechaza (el backend también lo rechaza)', () => {
    assert.equal(isEmail('x@y.z'), false);
  });

  test('email con caracteres invisibles, de control o no ASCII se rechaza', () => {
    for (const email of ['ana\u200b@ejemplo.com', 'ana@ejemplo.com\u0000x', 'añá@ejemplo.com', 'ana@ejémplo.com', 'ana\t@ejemplo.com']) {
      assert.equal(isEmail(email), false, JSON.stringify(email));
    }
  });

  test('inyección SQL con formato inválido se rechaza como email', () => {
    for (const email of ["' OR '1'='1", "admin@macroentreno.com' --", '" OR 1=1 --@x.com']) {
      assert.equal(isEmail(email), false, email);
    }
  });

  test('email de 190 caracteres es válido; de 191 → "Máximo 190 caracteres"', () => {
    const at190 = `${'a'.repeat(178)}@ejemplo.com`;
    assert.equal(at190.length, 190);
    assert.equal(validateEmail(at190), null);
    assert.equal(validateEmail(`a${at190}`), 'Máximo 190 caracteres');
    assert.equal(isEmail(`a${at190}`), false);
  });

  test('validateEmail con vacío o tipos que no son texto → "Ingresá un email válido"', () => {
    for (const value of ['', null, undefined, 123, {}, ['a@b.com']]) {
      assert.equal(validateEmail(value), 'Ingresá un email válido', String(value));
    }
  });

  test('nombre de 100 caracteres es válido; de 101 → "Máximo 100 caracteres"', () => {
    assert.equal(validateName('a'.repeat(100)), null);
    assert.equal(validateName('a'.repeat(101)), 'Máximo 100 caracteres');
    assert.equal(validateName(`   ${'a'.repeat(100)}   `), null);
  });

  test('nombre sin letras → "El nombre debe tener letras"', () => {
    for (const name of ['12', '...', '1234 5678', '😀😀']) {
      assert.equal(validateName(name), 'El nombre debe tener letras', name);
    }
  });

  test('nombre con caracteres de control o invisibles → "El nombre tiene caracteres no permitidos"', () => {
    for (const name of ['Ana\u0000Pérez', 'Ana\nPérez', '\u200b\u200bAna', 'Ana\u202ePérez']) {
      assert.equal(validateName(name), 'El nombre tiene caracteres no permitidos', JSON.stringify(name));
    }
  });

  test('nombre que no es texto → "Ingresá tu nombre"', () => {
    for (const name of [null, undefined, 12345, {}, ['Ana']]) assert.equal(validateName(name), 'Ingresá tu nombre');
  });

  test('nombres con tildes, ñ, apóstrofo o guion son válidos', () => {
    for (const name of ['José Núñez', "O'Connor", 'Ana-Lía', 'Łukasz', 'Al']) assert.equal(validateName(name), null, name);
  });

  test('contraseña de 72 caracteres es válida y de 73 → "Máximo 72 caracteres"', () => {
    assert.equal(validatePassword(`${'a'.repeat(71)}1`), null);
    assert.equal(validatePassword(`${'a'.repeat(72)}1`), 'Máximo 72 caracteres');
  });

  test('contraseña de menos de 72 caracteres pero más de 72 bytes (tildes/ñ/emojis) se rechaza', () => {
    const pwd = `${'ñ'.repeat(40)}a1`; // 42 caracteres, 82 bytes
    assert.equal(validatePassword(pwd), 'Es muy larga: las tildes, la ñ y los emojis ocupan más espacio');
    assert.equal(validatePassword(`${'ñ'.repeat(35)}a1`), null); // 72 bytes justos
  });

  test('contraseña de solo espacios o solo símbolos → "Debe tener letras y números"', () => {
    assert.equal(validatePassword(' '.repeat(10)), 'Debe tener letras y números');
    assert.equal(validatePassword('!!!!!!!!'), 'Debe tener letras y números');
  });

  test('contraseña que no es texto → "Mínimo 8 caracteres"', () => {
    for (const value of [12345678, ['Clave1234'], { length: 10 }]) {
      assert.equal(validatePassword(value), 'Mínimo 8 caracteres', JSON.stringify(value));
    }
  });

  test('login: contraseña de más de 72 bytes → "Máximo 72 caracteres"', () => {
    assert.deepEqual(validateLogin({ email: 'a@b.com', password: `${'a'.repeat(72)}1` }), {
      password: 'Máximo 72 caracteres',
    });
  });

  test('login: contraseña que no es texto → "Ingresá tu contraseña"', () => {
    assert.deepEqual(validateLogin({ email: 'a@b.com', password: 12345678 }), { password: 'Ingresá tu contraseña' });
  });

  test('registro con nombre inválido usa el mensaje específico', () => {
    assert.deepEqual(validateRegister({ ...validRegister(), name: 'Ana\u0000' }), {
      name: 'El nombre tiene caracteres no permitidos',
    });
  });
});
