import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import sinon from 'sinon';
import CreatableSelect from 'react-select/creatable';
import { components as reactSelectComponents } from 'react-select';

import OnPasteSelect from '../../../javascripts/components/OnPasteSelect';

const options = [
  'United States', 'China', 'India', 'Canada', 'Russian Federation', 'Japan', 'Mexico',
].map(value => ({ value, label: value }));

describe('OnPasteSelect', () => {
  afterEach(cleanup);

  it('selects existing values, creates valid new values, and removes duplicates', () => {
    const onChange = sinon.spy();
    const localOptions = options.slice();
    render(<OnPasteSelect
      isValidNewOption={option => Boolean(option.label)}
      isMulti
      onChange={onChange}
      options={localOptions}
      value={[]}
    />);
    fireEvent.paste(screen.getByRole('combobox'), {
      clipboardData: { getData: () => 'China, China, Mexico, Chi na, Mexico' },
    });
    expect(onChange.calledOnce).to.equal(true);
    expect(onChange.firstCall.args[0].map(option => option.value)).to.deep.equal([
      'China', 'Mexico', 'Chi na',
    ]);
    expect(localOptions[0].value).to.equal('Chi na');
  });

  it('supports custom keys and merges caller components', () => {
    const onChange = sinon.spy();
    const CustomOption = props => <div {...props.innerProps}>custom:{props.data.name}</div>;
    const CustomInput = props => (
      <reactSelectComponents.Input {...props} aria-label="custom paste input" />
    );
    const { container } = render(<OnPasteSelect
      components={{ Input: CustomInput, Option: CustomOption }}
      isMulti
      labelKey="name"
      onChange={onChange}
      options={[{ id: 'known', name: 'Known' }]}
      separator=";"
      value={[]}
      valueKey="id"
    />);
    expect(screen.getByLabelText('custom paste input')).not.to.equal(null);
    fireEvent.mouseDown(container.querySelector('.Select__control'));
    expect(screen.getByText('custom:Known')).not.to.equal(null);
    fireEvent.paste(screen.getByRole('combobox'), {
      clipboardData: { getData: () => 'known;new' },
    });
    expect(onChange.firstCall.args[0]).to.deep.equal([
      { id: 'known', name: 'Known' },
      { id: 'new', name: 'new' },
    ]);
  });

  it('supports the v5 Creatable component', () => {
    const onChange = sinon.spy();
    render(<OnPasteSelect
      SelectComponent={CreatableSelect}
      onChange={onChange}
      options={[]}
      value={null}
    />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'created' } });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Enter', code: 'Enter' });
    expect(onChange.firstCall.args[0]).to.include({ label: 'created', value: 'created' });
  });
});
