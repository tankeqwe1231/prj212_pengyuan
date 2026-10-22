import d3 from 'd3';
import nv from 'nvd3';
import { getColorFromScheme } from '../javascripts/modules/colors';
import { d3FormatPreset } from '../javascripts/modules/utils';

require('./histogram.css');

export function getHistogramHeight(sliceHeight, hasXAxisLabel) {
  const topMargin = 50;
  const bottomMargin = hasXAxisLabel ? 55 : 20;
  return Math.max(sliceHeight - topMargin - bottomMargin, 0);
}

function histogram(slice, payload) {
  const fd = slice.formData;
  const data = payload.data.data;
  const extraData = payload.data.extra_data;
  const div = d3.select(slice.selector);
  const numBins = Number(slice.formData.link_length) || 10;
  const normalized = slice.formData.normalized;
  const xAxisLabel = slice.formData.x_axis_label;
  const yAxisLabel = slice.formData.y_axis_label;
  const opacity = slice.formData.global_opacity;
  const yAxisFormatter = d3FormatPreset(fd.y_axis_format);
  const xAxisFormatter = d3FormatPreset(fd.x_axis_format);
  const margin = {
      top: 50,
      right: 10,
      bottom: 20,
      left: yAxisLabel ? 70 : 50,
    };

  const draw = function () {
    const width = slice.width() - margin.left - margin.right;
    // The dashboard/explore layout has already excluded its header from
    // slice.height(). Only reserve space used by this SVG's own x-axis.
    const height = getHistogramHeight(slice.height(), Boolean(xAxisLabel));

    // set number of ticks
    const maxTicks = 20;
    const numTicks = d3.min([maxTicks, numBins]);

    // Set Histogram objects
    const x = d3.scale.linear();
    const y = d3.scale.linear();
    const xAxis = d3.svg.axis()
    .scale(x)
    .orient('bottom')
    .ticks(numTicks, 's');
    const yAxis = d3.svg.axis()
    .scale(y)
    .orient('left')
    .ticks(numTicks, 's');

    // Set the x-values
    const max = d3.max(data, d => d3.max(d.values));
    const min = d3.min(data, d => d3.min(d.values));
    x.domain([min, max])
    .range([0, width], 0.1);

    // Calculate bins for the data
    let bins = [];
    const lineDict = {};
    data.forEach((d) => {
      const extraDataCur = extraData[d.key];
      let lenPreLast = 0;
      d.values.forEach((v) => {
          if (v <= extraDataCur.last) {
              lenPreLast++;
          }
      });
      lineDict[d.key] = { lenPreLast };
      let b = d3.layout.histogram().bins(numBins)(d.values);
      const color = getColorFromScheme(d.key, slice.formData.color_scheme);
      const w = d3.max([(x(b[0].dx) - x(0)) - 1, 0]);
      lineDict[d.key].w = w;
      const key = d.key;
      // normalize if necessary
      if (normalized) {
        const total = d.values.length;
        b = b.map(v => ({ ...v, y: v.y / total }));
      }
      bins = bins.concat(b.map(v => ({ ...v, color, width: w, key, opacity })));
      lineDict[d.key].len = d.values.length;
      bins.forEach((dt) => {
        const arrSort = [];
        Object.keys(dt).forEach(function (keystr) {
            if (Number.isInteger(parseInt(keystr,  10))) {
              arrSort.push(dt[keystr]);
            }
        });
        arrSort.sort((v1, v2) => v1 - v2);
        if (arrSort.length > 0) {
            Object.keys(extraDataCur).forEach(function (keystr) {
                if (arrSort[0] <= extraDataCur[keystr] &&
                    extraDataCur[keystr] <= arrSort[arrSort.length - 1]) {
                    lineDict[d.key][keystr] = x(dt.x);
                }
            });
        }
      });
    });

    if (fd.y_axis_format) {
        yAxis.tickFormat(yAxisFormatter);
    }
    if (fd.x_axis_format) {
        xAxis.tickFormat(xAxisFormatter);
    }

    // Set the y-values
    y.domain([0, d3.max(bins, d => d.y)])
    .range([height, 0]);

    // Create the svg value with the bins
    const svg = div.selectAll('svg')
    .data([bins])
    .enter()
    .append('svg');

    // Make a rectangular background fill
    // svg.append('rect')
    // .attr('width', '100%')
    // .attr('height', '100%')
    // .attr('fill', '#f6f6f6');

    // Transform the svg to make space for the margins
    const gEnter = svg
    .append('g')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

    // Add the bars and the x axis
    gEnter.append('g').attr('class', 'bars');
    gEnter.append('g').attr('class', 'x axis');

    // Add width and height to the svg
    svg.attr('width', slice.width())
    .attr('height', slice.height());

    // make legend
    const legend = nv.models.legend()
      .color(d => getColorFromScheme(d.key, slice.formData.color_scheme))
      .width(width);
    const gLegend = gEnter.append('g').attr('class', 'nv-legendWrap')
    .attr('transform', 'translate(0,' + (-margin.top) + ')')
    .datum(data.map(d => ({ ...d, disabled: false })));

    // function to draw bars and legends
    function update(selectedBins) {
      // Create the bars in the svg
      const bar = svg.select('.bars')
        .selectAll('rect')
        .data(selectedBins, d => d.key + d.x);
      // Set the Height and Width for each bar
      bar.enter()
        .append('rect')
        .attr('width', d => d.width)
        .attr('x', d => x(d.x))
        .style('fill', d => d.color)
        .style('fill-opacity', d => d.opacity)
        .attr('y', d => y(d.y))
        .attr('height', d => y.range()[0] - y(d.y))
        .on('mouseover', showTooltip)
        .on('mousemove', moveTooltip)
        .on('mouseleave', hideTooltip);
      bar.exit()
        .attr('y', y(0))
        .attr('height', 0)
        .remove();
      // apply legend
      gLegend.call(legend);
    }

    update(bins);
    Object.keys(lineDict).forEach(function (keystr) {
      const lineObj = lineDict[keystr];
      Object.keys(lineObj).forEach(function (keystr1) {
        if (keystr1 === 'w' || keystr1 === 'lenPreLast' || keystr1 === 'len') return;
        const xPosition = lineObj[keystr1] + lineObj.w / 2;
        if (keystr1 !== 'last' && fd.highlight_tick_zero) {
          svg.select('.bars').append('line')
              .attr('x1', xPosition)
              .attr('y1', 0)
              .attr('x2', xPosition)
              .attr('y2', height)
              .style('stroke', 'black')
              .style('stroke-dasharray', '10')
              .style('stroke-width', 1);
          svg.select('.bars').append('text')
              .attr('x', xPosition - lineObj.w * 2)
              .attr('y', 0)
              .style('font-size', '14px')
              .text(parseFloat(keystr1) * 100 + '%');
        }
        if (keystr1 === 'last' && fd.column_isdate) {
          const lastPos = lineObj.lenPreLast / lineObj.len;
          svg.select('.bars').append('line')
              .attr('x1', xPosition)
              .attr('y1', 0)
              .attr('x2', xPosition)
              .attr('y2', height)
              .style('stroke', 'black')
              .style('stroke-width', 1);
          svg.select('.bars').append('text')
              .attr('x', xPosition - lineObj.w * 5)
              .attr('y', -15)
              .style('font-size', '14px')
              .text('Now=' + extraData[keystr].last + '(' + (lastPos * 100).toFixed(2) + '%)');
        }
            });
      });
    // update(bins);
    // Update the x-axis
    svg.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(' + margin.left + ',' + (height + margin.top) + ')')
    .text('values')
    .call(xAxis);

    // Update the Y Axis and add minor lines
    svg.append('g')
    .attr('class', 'axis')
    .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')')
    .text('count')
    .call(yAxis)
    .selectAll('g')
    .filter(function (d) { return d; })
    .classed('minor', true);

    // set callback on legend toggle
    legend.dispatch.on('stateChange', function (newState) {
      const activeKeys = data
      .filter((d, i) => !newState.disabled[i])
      .map(d => d.key);
      update(bins.filter(d => activeKeys.indexOf(d.key) >= 0));
    });

    // add axis labels if passed
    if (xAxisLabel) {
      svg.append('text')
        .attr('transform',
              'translate(' + ((width + margin.left) / 2) + ' ,' +
                             (height + margin.top + 45) + ')')
        .style('text-anchor', 'middle')
        .text(xAxisLabel);
    }
    if (yAxisLabel) {
      svg.append('text')
        .attr('transform', 'rotate(-90)')
        .attr('y', '1em')
        .attr('x', 0 - (height / 2))
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .text(yAxisLabel);
    }
  };

  div.selectAll('*').remove();
  // Add a tooltip div.
  const tooltip = d3.select('#' + slice.containerId)
    .append('div')
    .style('opacity', 0)
    .style('display', 'block')
    .style('visibility', 'visible')
    .attr('class', 'histogram-tooltip')
    .style('position', 'absolute')
    .style('left', '0px')
    .style('top', '0px')
    .style('z-index', -1)
    .style('background-color', 'black')
    .style('color', 'white')
    .style('border-radius', '5px')
    .style('border', '1px solid black')
    .style('padding', '0')
    .style('font-size', '12px')
    .style('line-height', '1.4')
    .style('white-space', 'nowrap')
    .style('pointer-events', 'none');

  // Gap kept between the pointer and the bottom edge of the tooltip.
  const tooltipGap = 10;

  const moveTooltip = function () {
    const node = tooltip.node();
    if (!node || !this) return;

    // The slice container is not positioned, so the tooltip is laid out
    // against an outer element.  Measuring the pointer in that element's
    // coordinate system keeps the tooltip anchored to the cursor.
    const offsetParent = node.offsetParent || node.parentNode;
    const [mouseX, mouseY] = d3.mouse(offsetParent);

    tooltip
      .style('left', (mouseX - (node.offsetWidth / 2)) + 'px')
      .style('top', (mouseY - node.offsetHeight - tooltipGap) + 'px');
  };

  // A function that change this tooltip when the user hover a point.
  const showTooltip = function (d) {
    const rangeArr = [];
    Object.keys(d).forEach(function (keystr) {
            if (Number.isInteger(parseInt(keystr,  10))) {
              rangeArr.push(d[keystr]);
            }
        });
    rangeArr.sort();
    tooltip
      .transition()
      .duration(100)
      .style('opacity', 1)
      .style('z-index', 1070);
    tooltip
      .style('padding', '8px 10px')
      .html('Range: ' + rangeArr[0] + ' - ' + rangeArr[rangeArr.length - 1] + '<br />Count: ' + rangeArr.length);
    moveTooltip.call(this);
  };

  // A function that change this tooltip when
  const hideTooltip = function () {
    tooltip
      .transition()
      .duration(100)
      .style('opacity', 0)
      .style('z-index', -1)
      .style('padding', '0')
      .style('left', '0px')
      .style('top', '0px');
    tooltip.html('');
  };
  draw();
}

export default histogram;
