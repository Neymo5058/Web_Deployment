import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';
import { createI18n } from 'vue-i18n';
import SearchBar from '../SearchBar.vue';

const createWrapper = (options = {}) => {
  const i18n = createI18n({
    legacy: false,
    locale: 'en',
    messages: {
      en: {
        event: {
          searchPlaceholder: 'Search for events',
          searchAriaLabel: 'Search events',
        },
      },
    },
  });

  return mount(SearchBar, {
    global: {
      plugins: [i18n],
    },
    ...options,
  });
};

describe('SearchBar', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('emits search events after debounce when user types', async () => {
    const wrapper = createWrapper({
      props: {
        debounce: 150,
      },
    });

    const input = wrapper.get('input');
    await input.setValue('Rock concert');

    const updates = wrapper.emitted('update:modelValue');
    expect(updates).toBeTruthy();
    expect(updates[0]).toEqual(['Rock concert']);

    expect(wrapper.emitted('search')).toBeFalsy();

    vi.advanceTimersByTime(150);

    const searches = wrapper.emitted('search');
    expect(searches).toBeTruthy();
    expect(searches[0]).toEqual(['Rock concert']);
  });

  it('emits model updates immediately while deferring search event', async () => {
    const wrapper = createWrapper();

    const input = wrapper.get('input');
    await input.setValue('Music');

    const updates = wrapper.emitted('update:modelValue');
    expect(updates).toEqual([['Music']]);

    expect(wrapper.emitted('search')).toBeUndefined();

    vi.runAllTimers();

    expect(wrapper.emitted('search')).toEqual([['Music']]);
  });

  it('synchronises when modelValue prop changes from parent', async () => {
    const wrapper = createWrapper({
      props: {
        modelValue: 'Initial value',
      },
    });

    expect(wrapper.get('input').element.value).toBe('Initial value');

    await wrapper.setProps({ modelValue: 'Updated from parent' });
    await nextTick();

    expect(wrapper.get('input').element.value).toBe('Updated from parent');

    vi.advanceTimersByTime(300);

    const searches = wrapper.emitted('search');
    expect(searches).toBeTruthy();
    expect(searches.at(-1)).toEqual(['Updated from parent']);
  });

  it('does not re-emit when receiving the same modelValue', async () => {
    const wrapper = createWrapper({
      props: {
        modelValue: 'Static value',
      },
    });

    await wrapper.setProps({ modelValue: 'Static value' });
    vi.runAllTimers();

    expect(wrapper.emitted('search')).toBeUndefined();
  });

  it('provides translated placeholder and aria label text', () => {
    const wrapper = createWrapper();
    const input = wrapper.get('input');

    expect(input.attributes('placeholder')).toBe('Search for events');
    expect(input.attributes('aria-label')).toBe('Search events');
  });

  it('clears any pending debounce timer on unmount', async () => {
    const wrapper = createWrapper({
      props: {
        debounce: 500,
      },
    });

    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    await wrapper.get('input').setValue('Jazz');
    clearTimeoutSpy.mockClear();

    wrapper.unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledTimes(1);

    clearTimeoutSpy.mockRestore();
  });
});
