/**
 * @file circuitBreaker.js
 * @description 3-State Circuit Breaker Pattern implementation (Closed, Open, Half-Open).
 *
 * Concepts demonstrated in this file:
 * - Resilience Engineering & Fault Tolerance: Circuit breaker isolating downstream service failures (e.g. OpenRouter LLM API)
 * - State Machine Modeling: Formal transitions between CLOSED, OPEN, and HALF_OPEN states
 * - Graceful Degradation: Fast-failing broken dependencies without exhausting thread pools or incurring network timeouts
 */

const STATE = {
  CLOSED: 'CLOSED',
  OPEN: 'OPEN',
  HALF_OPEN: 'HALF_OPEN',
};

class CircuitBreaker {
  /**
   * @param {Function} action - The async operation to wrap with circuit protection.
   * @param {Object} options - Configuration parameters.
   * @param {number} [options.failureThreshold=3] - Number of consecutive failures before opening the circuit.
   * @param {number} [options.cooldownMs=30000] - Duration in ms to stay in OPEN state before trying HALF_OPEN.
   * @param {string} [options.name='Service'] - Identifying name for logging.
   */
  constructor(action, { failureThreshold = 3, cooldownMs = 30000, name = 'Service' } = {}) {
    this.action = action;
    this.failureThreshold = failureThreshold;
    this.cooldownMs = cooldownMs;
    this.name = name;

    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = Date.now();
  }

  /**
   * Executes the wrapped action through the circuit breaker state machine.
   *
   * @param  {...any} args - Arguments passed to the wrapped action.
   * @returns {Promise<any>} Resolves with the action result.
   * @throws {Error} If circuit is OPEN or the underlying action fails.
   */
  async execute(...args) {
    const now = Date.now();

    // State transition check: OPEN -> HALF_OPEN after cooldown expires
    if (this.state === STATE.OPEN) {
      if (now >= this.nextAttempt) {
        this.state = STATE.HALF_OPEN;
        // eslint-disable-next-line no-console
        console.warn(`[CircuitBreaker:${this.name}] Cooldown expired. Transitioning to HALF_OPEN (probing...)`);
      } else {
        const remainingMs = this.nextAttempt - now;
        const err = new Error(`Circuit for ${this.name} is OPEN (fast-fail). Retry in ${Math.ceil(remainingMs / 1000)}s`);
        err.isCircuitOpen = true;
        throw err;
      }
    }

    try {
      const result = await this.action(...args);
      this._onSuccess();
      return result;
    } catch (err) {
      this._onFailure(err);
      throw err;
    }
  }

  _onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      // eslint-disable-next-line no-console
      console.log(`[CircuitBreaker:${this.name}] Trial request succeeded. Circuit resetting to CLOSED.`);
    }
    this.state = STATE.CLOSED;
    this.failureCount = 0;
  }

  _onFailure(err) {
    this.failureCount += 1;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN || this.failureCount >= this.failureThreshold) {
      this.state = STATE.OPEN;
      this.nextAttempt = Date.now() + this.cooldownMs;
      // eslint-disable-next-line no-console
      console.error(
        `[CircuitBreaker:${this.name}] ${this.failureCount} consecutive failure(s). Tripping to OPEN for ${this.cooldownMs / 1000}s. Last error: ${err.message}`
      );
    }
  }

  getState() {
    return {
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.state === STATE.OPEN ? this.nextAttempt : null,
    };
  }
}

module.exports = { CircuitBreaker, STATE };
