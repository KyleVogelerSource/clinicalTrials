import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { DebugMessageService } from './debug-message.service';

describe('DebugMessageService', () => {
  it('sets and clears the current debug message', () => {
    TestBed.configureTestingModule({});
    const service = TestBed.inject(DebugMessageService);

    expect(service.message()).toBeNull();

    service.setMessage('Backend unavailable');
    expect(service.message()).toBe('Backend unavailable');

    service.clear();
    expect(service.message()).toBeNull();
  });
});
