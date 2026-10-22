import React from 'react';
import { renderReact } from '../modules/reactRoot';
import { appSetup } from '../common';
import AddSliceContainer from './AddSliceContainer';

appSetup();

const addSliceContainer = document.getElementById('js-add-slice-container');
const bootstrapData = JSON.parse(addSliceContainer.getAttribute('data-bootstrap'));

renderReact(
  <AddSliceContainer datasources={bootstrapData.datasources} />,
  addSliceContainer,
);
