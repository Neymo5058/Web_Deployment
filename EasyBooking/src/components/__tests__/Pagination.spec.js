import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import Pagination from '../Pagination.vue';

describe('Pagination', () => {
  const createWrapper = (props = {}) =>
    mount(Pagination, {
      props: {
        currentPage: 2,
        totalPages: 5,
        ...props,
      },
    });

  it('emits change-page when clicking numbered buttons', async () => {
    const wrapper = createWrapper();

    const pageButtons = wrapper.findAll('button').slice(1, -1);
    await pageButtons[2].trigger('click');

    const emissions = wrapper.emitted('change-page');
    expect(emissions).toBeTruthy();
    expect(emissions[0]).toEqual([3]);
  });

  it('emits change-page for navigation buttons respecting bounds', async () => {
    const wrapper = createWrapper();

    await wrapper.get('button:last-of-type').trigger('click');
    expect(wrapper.emitted('change-page')[0]).toEqual([3]);

    await wrapper.get('button:first-of-type').trigger('click');
    expect(wrapper.emitted('change-page')[1]).toEqual([1]);
  });

  it('prevents navigation beyond first or last page', async () => {
    const wrapper = createWrapper({ currentPage: 1 });

    await wrapper.get('button:first-of-type').trigger('click');
    expect(wrapper.emitted('change-page')).toBeFalsy();

    await wrapper.setProps({ currentPage: 5 });
    await wrapper.get('button:last-of-type').trigger('click');

    expect(wrapper.emitted('change-page')).toBeFalsy();
  });

  it('marks the active page button', () => {
    const wrapper = createWrapper({ currentPage: 4 });
    const activeButton = wrapper.findAll('button').find((button) =>
      button.classes().includes('active')
    );

    expect(activeButton).toBeTruthy();
    expect(activeButton.text()).toBe('4');
  });

  it('renders sequential page labels for each total page', () => {
    const wrapper = createWrapper({ totalPages: 4 });
    const numberedButtons = wrapper.findAll('button').slice(1, -1);

    expect(numberedButtons).toHaveLength(4);
    expect(numberedButtons.map((button) => button.text())).toEqual([
      '1',
      '2',
      '3',
      '4',
    ]);
  });

  it('disables navigation buttons when on boundary pages', async () => {
    const wrapper = createWrapper({ currentPage: 1 });

    const previousButton = wrapper.get('button:first-of-type');
    const nextButton = wrapper.get('button:last-of-type');

    expect(previousButton.attributes('disabled')).toBeDefined();
    expect(nextButton.attributes('disabled')).toBeUndefined();

    await wrapper.setProps({ currentPage: 5 });

    expect(previousButton.attributes('disabled')).toBeUndefined();
    expect(nextButton.attributes('disabled')).toBeDefined();
  });
});
