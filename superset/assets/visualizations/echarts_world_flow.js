import echarts from 'echarts';
import { colorScalerFactory, spectrums } from '../javascripts/modules/colors';
import { d3FormatPreset } from '../javascripts/modules/utils';


function echartsWorldFlow(slice, payload) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html =
      '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + (slice.height() - 5) + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    const sourceData = payload.data;
    const geoCoordMap = sourceData.dict_city_location;
    const cityFlow = sourceData.list_city_flow;
    const countryWeight = sourceData.df_country_weight;

    require('../javascripts/modules/maps/' + fd.map_select);

    function convertData(data, toName) {
        const res = [];
        for (let i = 0; i < data.length; i++) {
            const dataItem = data[i];
            const fromCoord = geoCoordMap[dataItem[0]];
            const toCoord = geoCoordMap[toName];
            if (fromCoord && toCoord) {
                res.push([{
                    coord: fromCoord,
                    value: dataItem[1],
                    fromName: dataItem[0],
                    toName,
                }, {
                    coord: toCoord,
                    value: dataItem[1],
                    fromName: dataItem[0],
                    toName,
                }]);
            }
        }
        return res;
    }

    const colorFactory =
      colorScalerFactory(fd.country_linear_color_scheme, countryWeight.data[1], v => v);

    function convertCountryData(data, index) {
      return {
        name: data[0][index],
        value: data[1][index],
        visualMap: false,
        itemStyle: {
            normal: {
                areaColor: colorFactory(data[1][index]),
            },
        },
      };
    }

    function convertToolip(params) {
        // 根据业务自己拓展要显示的内容
        const {seriesType, data, value} = params;
        if (!data) return ''; // 如果没有数据，直接返回空字符串

        const tooltipStyle = '<span style="color:#fff;">';
        if (seriesType === 'lines') {
            return `${tooltipStyle}${data.fromName} > ${data.toName}</span><br/>数据：${d3FormatPreset(fd.lable_format)(value)}`;
        } else if (seriesType === 'map') {
            return `${tooltipStyle}${data.name}</span><br/>数据：${d3FormatPreset(fd.lable_format)(value)}`;
        }

        return '';
    }


    const color = ['#fff', '#ffa022', '#46bee9'];
    const cityFlowSeries = [];


    cityFlow.forEach(
      function (item, i) {
        cityFlowSeries.push(
            {
                name: item[0],
                type: 'lines',
                zlevel: 1,
                effect: {
                    show: true,
                    period: 6,
                    trailLength: 0,
                    symbol: 'arrow',
                    symbolSize: 15,
                    loop: fd.arrow_loop,
                },
                label: {
                    emphasis: {
                        show: true,
                    },
                },
                lineStyle: {
                    normal: {
                        color: color[i],
                        width: 2,
                        opacity: 0.8,
                        curveness: 0.2,
                    },
                    emphasis: {
                        color: color[i],
                        shadowColor: 'rgba(0, 0, 0, 0.5)',
                        shadowBlur: 10,
                        width: 3,
                    },
                },
                data: convertData(item[1], item[0]),
            },
            {
                type: 'effectScatter',
                coordinateSystem: 'geo',
                zlevel: 2,
                // 涟漪特效
                rippleEffect: {
                    // 动画时间，值越小速度越快
                    period: 4,
                    // 波纹绘制方式 stroke, fill
                    brushType: 'stroke',
                    // 波纹圆环最大限制，值越大波纹越大
                    scale: 4,
                    trailLength: 0,
                },
                label: {
                    normal: {
                        show: true,
                        // 显示位置
                        position: 'right',
                        // 偏移设置
                        offset: [5, 0],
                        // 圆环显示文字
                        formatter: '{b}',
                    },
                    emphasis: {
                        show: true,
                    },
                },
                symbol: 'circle',
                symbolSize: val => 4 + val[2] / 1000,
                itemStyle: {
                    normal: {
                        show: false,
                        color: '#f00',
                    },
                },
                data: item[1].map(function (dataItem) {
                    return {
                        name: dataItem[0],
                        value: geoCoordMap[dataItem[0]].concat([dataItem[1]]),
                    };
                }),
            },
            // 被攻击点
            {
                type: 'scatter',
                coordinateSystem: 'geo',
                zlevel: 2,
                rippleEffect: {
                    period: 4,
                    brushType: 'stroke',
                    scale: 4,
                },
                label: {
                    normal: {
                        show: true,
                        position: 'right',
                        // offset:[5, 0],
                        color: '#00ffff',
                        formatter: '{b}',
                        textStyle: {
                            color: '#00ffff',
                        },
                    },
                    emphasis: {
                        show: true,
                    },
                },
                symbol: 'pin',
                symbolSize: 30,
                itemStyle: {
                    normal: {
                        show: true,
                        color: '#9966cc',
                    },
                },
                data: [{
                    name: item[0],
                    value: geoCoordMap[item[0]].concat([100]),
                }],
            },
        );
    });

    cityFlowSeries.push({
        type: 'map',
        map: fd.map_select,
        geoIndex: 0,
        aspectScale: 0.75, // 长宽比
        showLegendSymbol: false, // 存在legend时显示
        animation: false,
        data: [...Array(countryWeight.data[0].length).keys()].map(
                x => convertCountryData(countryWeight.data, x),
              ),
    });

    const option = {
        backgroundColor: '#404a59',
        tooltip: {
            trigger: 'item',
            backgroundColor: 'rgba(12, 204, 104, 0.92)',
            borderColor: '#FFFFCC',
            showDelay: 0,
            hideDelay: 0,
            enterable: true,
            transitionDuration: 0,
            extraCssText: 'z-index:100',
            formatter: params => convertToolip(params),
        },
        // 图例值控制
        visualMap: {
            min: sourceData.visual_map_min_value,
            max: sourceData.visual_map_max_value,
            calculable: true,
            color: [...spectrums[fd.world_flow_linear_color_scheme]].reverse(),
            textStyle: {
                color: '#fff',
            },
            hoverLink: false,
        },
        geo: {
            map: fd.map_select,
            label: {
                 show: (fd.show_area_name | fd.show_area_value),
                 formatter: (params) => {
                     if(countryWeight.data[0].indexOf(params.name) < 0) {
                         return '';
                     }
                     const seriseNamePos = countryWeight.data[0].indexOf(params.name);
                     let seriseValue = '';
                    if (seriseNamePos >= 0 && fd.show_area_value) {
                        seriseValue = countryWeight.data[1][seriseNamePos];
                    }
                    let rtnStr = '';
                    if (fd.show_area_name) {
                        rtnStr += params.name;
                        if (fd.show_area_value) {
                            rtnStr += ':';
                        }
                    }
                    if (fd.show_area_value) {
                        rtnStr += d3FormatPreset(fd.lable_format)(seriseValue);
                    }
                    return rtnStr;
                 },
                emphasis: {
                    show: false,
                },
             },
            // 是否允许缩放
            roam: true,
            // 地图位置
            zoom: parseFloat(fd.map_zoom_factor),
            center: (fd.map_center_longitude !== null && fd.map_center_longitude !== undefined &&
                fd.map_center_latitude !== null && fd.map_center_latitude !== undefined)
                ? [parseFloat(fd.map_center_longitude), parseFloat(fd.map_center_latitude)]
                : [],
            itemStyle: {
                normal: {
                    // 地图背景色
                    color: 'rgba(51, 69, 89, .5)',
                    // 省市边界线
                    borderColor: 'rgba(100,149,237,1)',
                },
                emphasis: {
                    // 悬浮背景
                    color: 'rgba(37, 43, 61, .5)',
                },
            },
            regions:
              [...Array(countryWeight.data[0].length).keys()].map(
                x => convertCountryData(countryWeight.data, x),
              ),
        },
        series: cityFlowSeries,
    };

    // const jsonurl = '/static/assets/javascripts/geojson/china.json';
    // $.getJSON(jsonurl, function (geoJson) {
    //     echarts.registerMap('china', geoJson);
    //     myChart.setOption(option);
    // });


  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);
}

export default echartsWorldFlow;
