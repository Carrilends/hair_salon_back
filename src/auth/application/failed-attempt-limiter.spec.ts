import { FailedAttemptLimiter } from './failed-attempt-limiter';

const T0 = new Date('2026-10-28T15:00:00.000Z');
const mas = (ms: number) => new Date(T0.getTime() + ms);

describe('FailedAttemptLimiter', () => {
  it('bloquea al llegar al máximo de fallos dentro de la ventana', () => {
    const l = new FailedAttemptLimiter(3, 1000);
    l.recordFailure('a', T0);
    l.recordFailure('a', mas(10));
    expect(l.isBlocked('a', mas(20))).toBe(false);
    l.recordFailure('a', mas(30));
    expect(l.isBlocked('a', mas(40))).toBe(true);
  });

  it('los fallos caducan con la ventana', () => {
    const l = new FailedAttemptLimiter(2, 1000);
    l.recordFailure('a', T0);
    l.recordFailure('a', mas(500));
    expect(l.isBlocked('a', mas(999))).toBe(true);
    // El primero sale de la ventana: queda uno.
    expect(l.isBlocked('a', mas(1000))).toBe(false);
  });

  it('cada clave lleva su cuenta y clear la borra', () => {
    const l = new FailedAttemptLimiter(1, 1000);
    l.recordFailure('a', T0);
    expect(l.isBlocked('a', T0)).toBe(true);
    expect(l.isBlocked('b', T0)).toBe(false);
    l.clear('a');
    expect(l.isBlocked('a', T0)).toBe(false);
  });
});
