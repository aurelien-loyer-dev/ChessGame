import { describe, expect, it } from 'vitest';
import { decideSync } from '../lib/cloud';

const T = 1_700_000_000_000;

describe('decideSync', () => {
  it('uploads a local profile when the cloud is empty', () => {
    expect(decideSync({ localRegistered: true, cloud: null, lastSyncedAt: null, dirtyAt: null })).toBe('push');
    expect(decideSync({ localRegistered: false, cloud: null, lastSyncedAt: null, dirtyAt: null })).toBe('none');
  });

  it('restores the cloud save on a fresh device', () => {
    expect(decideSync({ localRegistered: false, cloud: { updatedAt: T }, lastSyncedAt: null, dirtyAt: null })).toBe('pull');
  });

  it('asks when an unknown local profile meets an existing save', () => {
    expect(decideSync({ localRegistered: true, cloud: { updatedAt: T }, lastSyncedAt: null, dirtyAt: T })).toBe('conflict');
  });

  it('lets the side that changed since the last sync win', () => {
    const base = { localRegistered: true, lastSyncedAt: T };
    expect(decideSync({ ...base, cloud: { updatedAt: T + 60_000 }, dirtyAt: null })).toBe('pull');
    expect(decideSync({ ...base, cloud: { updatedAt: T }, dirtyAt: T + 5_000 })).toBe('push');
    expect(decideSync({ ...base, cloud: { updatedAt: T }, dirtyAt: null })).toBe('none');
    expect(decideSync({ ...base, cloud: { updatedAt: T + 60_000 }, dirtyAt: T + 5_000 })).toBe('conflict');
  });
});
