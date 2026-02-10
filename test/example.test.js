import {
  describe, it, expect, beforeEach,
} from 'vitest'

/**
 * Example test file demonstrating Vitest usage
 * Run with: yarn test
 * Watch mode: yarn test:watch
 * Coverage: yarn test:coverage
 */

describe('Example Test Suite', () => {
  it('should demonstrate basic assertions', () => {
    expect(1 + 1).toBe(2)
    expect('hello').toBeTruthy()
    expect([1, 2, 3]).toHaveLength(3)
  })

  it('should work with async code', async () => {
    const result = await Promise.resolve('success')
    expect(result).toBe('success')
  })

  it('should handle objects', () => {
    const user = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30,
    }

    expect(user).toHaveProperty('name', 'John Doe')
    expect(user).toMatchObject({email: 'john@example.com'})
  })

  it('should work with arrays', () => {
    const numbers = [1, 2, 3, 4, 5]

    expect(numbers).toContain(3)
    expect(numbers).toEqual([1, 2, 3, 4, 5])
  })
})

describe('Math Utilities Example', () => {
  const add = (a, b) => a + b
  const multiply = (a, b) => a * b

  describe('add function', () => {
    it('should add two positive numbers', () => {
      expect(add(2, 3)).toBe(5)
    })

    it('should add negative numbers', () => {
      expect(add(-2, -3)).toBe(-5)
    })

    it('should handle zero', () => {
      expect(add(0, 5)).toBe(5)
    })
  })

  describe('multiply function', () => {
    it('should multiply two numbers', () => {
      expect(multiply(3, 4)).toBe(12)
    })

    it('should handle zero', () => {
      expect(multiply(5, 0)).toBe(0)
    })
  })
})

describe('Setup and Teardown Example', () => {
  let testData

  beforeEach(() => {
    // This runs before each test
    testData = {counter: 0}
  })

  it('should start with counter at 0', () => {
    expect(testData.counter).toBe(0)
  })

  it('should increment counter', () => {
    testData.counter++
    expect(testData.counter).toBe(1)
  })

  it('should have fresh data each time', () => {
    // This demonstrates that beforeEach runs before each test
    expect(testData.counter).toBe(0)
  })
})
