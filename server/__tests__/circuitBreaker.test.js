/**
 * @file circuitBreaker.test.js
 * @description Unit tests for CircuitBreaker state transitions (Closed, Open, Half-Open).
 */
const { CircuitBreaker, STATE } = require('../src/utils/circuitBreaker');

describe('CircuitBreaker Pattern', () => {
  it('should start in CLOSED state and execute actions successfully', async () => {
    const mockAction = jest.fn().mockResolvedValue('success');
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 3, cooldownMs: 100 });

    expect(breaker.state).toBe(STATE.CLOSED);
    const result = await breaker.execute();
    expect(result).toBe('success');
    expect(breaker.state).toBe(STATE.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });

  it('should transition from CLOSED to OPEN after reaching failure threshold', async () => {
    const mockAction = jest.fn().mockRejectedValue(new Error('Network failure'));
    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 2, cooldownMs: 50 });

    // Failure 1
    await expect(breaker.execute()).rejects.toThrow('Network failure');
    expect(breaker.state).toBe(STATE.CLOSED);
    expect(breaker.failureCount).toBe(1);

    // Failure 2 -> Threshold reached -> Trips to OPEN
    await expect(breaker.execute()).rejects.toThrow('Network failure');
    expect(breaker.state).toBe(STATE.OPEN);
    expect(breaker.failureCount).toBe(2);

    // Immediate next call should fast-fail without calling underlying action
    await expect(breaker.execute()).rejects.toThrow(/is OPEN \(fast-fail\)/);
    expect(mockAction).toHaveBeenCalledTimes(2); // Not called a 3rd time
  });

  it('should transition to HALF_OPEN after cooldown and reset to CLOSED on success', async () => {
    let shouldFail = true;
    const mockAction = jest.fn().mockImplementation(async () => {
      if (shouldFail) throw new Error('API down');
      return 'recovered';
    });

    const breaker = new CircuitBreaker(mockAction, { failureThreshold: 1, cooldownMs: 30 });

    // Trip to OPEN
    await expect(breaker.execute()).rejects.toThrow('API down');
    expect(breaker.state).toBe(STATE.OPEN);

    // Wait for cooldown
    await new Promise((resolve) => setTimeout(resolve, 40));

    // Next request transitions to HALF_OPEN and attempts recovery
    shouldFail = false;
    const result = await breaker.execute();
    expect(result).toBe('recovered');
    expect(breaker.state).toBe(STATE.CLOSED);
    expect(breaker.failureCount).toBe(0);
  });
});
