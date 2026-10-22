import echarts from 'echarts';

function echartsDynamicLineChart(slice) {
    const div = d3.select(slice.selector);
    const fd = slice.formData;
    const sliceId = slice.containerId + '_slice_' + fd.slice_id;
    const html = '<div id=' + sliceId + ' style="width:' + slice.width() + 'px;height:' + slice.height() + 'px;"></div>';
    div.html(html); // reset

    const myChart = echarts.init(document.getElementById(sliceId));

    // let historyMinUrl = 'https://data.thanf.com/get_recent_bars?order_book_id=000001.SH&ktype=1&is_prev=1&is_need_column=1';
    // let latestDataInterfaceUrl = 'https://data.thanf.com/get_recent_bars?order_book_id=000001.SH&ktype=1&is_need_column=1';
    // const timeColumnName = 'EndTime';
    // const valueColumnName = 'Turnover';
    // const titleName = '日内对比曲线';
    // const isAccumValue = true;

    const historyMinUrl = fd.history_data_interface_url;
    const latestDataInterfaceUrl = fd.latest_data_interface_url;
    const timeColumnName = fd.date_column_name;
    const valueColumnName = fd.value_column_name;
    let titleName = fd.chart_title;
    const isAccumValue = fd.whether_use_accumulate_value;
    const refreshInterval = fd.refresh_interval;
    const seriesData = [];
    let timeArray = null;
    let dividend = 1;

    let formatterStr = '{value}';
    if (fd.value_type === 'percent') {
        formatterStr += ' %';
        titleName += ' (%)';
        dividend = 0.01;
    } else if (fd.value_type === 'ten thousand') {
        formatterStr += ' 万';
        titleName += ' (万)';
        dividend = 10000;
    } else if (fd.value_type === 'a hundred million') {
        formatterStr += ' 亿';
        titleName += ' (亿)';
        dividend = 100000000;
    }

    // 行转列函数
    function RowToColumn(dataArray) {
        const arrNew = [];
        // 确定新数组有多少行
        for (let i = 0; i < dataArray[0].length; i++) {
            arrNew[i] = [];
        }
        // 动态添加数据
        // 遍历原数组
        for (let i = 0; i < dataArray.length; i++) {
         for (let j = 0; j < dataArray[i].length; j++) {
          arrNew[j][i] = dataArray[i][j];
         }
        }
        return arrNew;
    }

    // 输入时间序列，数值序列，按照日来切分
    function SplitDataByDate(dateArrayVal, dataArrayVal) {
        const tmpStartDate = dateArrayVal[0].split(' ')[0];
        let tmpDate = tmpStartDate;
        const retDict = {
            dateColumn: [],
            timeArray: [],
            valuesArray: [[]],
        };
        retDict.dateColumn.push(tmpDate);
        let pushDataToArrayIndex = 0;
        for (let i = 0; i < dateArrayVal.length; i++) {
            const tmpTimeArray = dateArrayVal[i].split(' ');
            if (tmpTimeArray[0] !== tmpDate) {
                retDict.valuesArray.push([]);
                tmpDate = tmpTimeArray[0];
                retDict.dateColumn.push(tmpDate);
                pushDataToArrayIndex++;
            }
            if (tmpTimeArray[0] === tmpStartDate) {
                retDict.timeArray.push(tmpTimeArray[1]);
            }
            retDict.valuesArray[pushDataToArrayIndex].push(dataArrayVal[i]);
        }
        return retDict;
    }

    // 对一列数据进行累计求和
    function AccumOneArrayValue(dataArrayVal) {
        let sum = 0;
        const retArray = [];
        for (let i = 0; i < dataArrayVal.length; i++) {
            sum += dataArrayVal[i];
            retArray.push(Math.round(sum));
        }
        return retArray;
    }

    // 对一列数据进行累计除法
    function DividendOneArrayValue(dataArrayVal, dividendVal) {
        const retArray = [];
        for (let i = 0; i < dataArrayVal.length; i++) {
            retArray.push(dataArrayVal[i] / dividendVal);
        }
        return retArray;
    }

    // 对一列数据进行累计求和
    function LoadAndHandleData(urlTmp) {
      if (urlTmp.length === 0) {
        return {};
      }
      // 数据读取
      let dataArray = $.getJSON({ url: urlTmp, async: false }).responseJSON;
      if (dataArray.length === 0) {
        return {};
      }

      // 数据处理
      const columns = dataArray.splice(0, 1)[0];
      const dateColumnIndex = columns.indexOf(timeColumnName);
      const dataColumnIndex = columns.indexOf(valueColumnName);
      // console.log(dataColumnIndexes)
      dataArray = RowToColumn(dataArray);
      const dataDictTmp = SplitDataByDate(dataArray[dateColumnIndex], dataArray[dataColumnIndex]);
      if (dividend !== 1) {
        dataDictTmp.valuesArray =
          dataDictTmp.valuesArray.map(x => DividendOneArrayValue(x, dividend));
      }
      if (isAccumValue) {
        dataDictTmp.valuesArray = dataDictTmp.valuesArray.map(x => AccumOneArrayValue(x));
      }
      return dataDictTmp;
    }

    // 设置提供给SeriesData的数据
    function SetSeriesData(dataDictTmp) {
      if (JSON.stringify(dataDictTmp) === '{}') {
        return;
      }
      if (timeArray == null) {
        timeArray = dataDictTmp.timeArray;
      }
      for (let i = 0; i < dataDictTmp.valuesArray.length; i++) {
        seriesData.push({
          type: 'line',
          data: dataDictTmp.valuesArray[i],
          name: dataDictTmp.dateColumn[i],
        });
      }
    }

    SetSeriesData(LoadAndHandleData(historyMinUrl));
    SetSeriesData(LoadAndHandleData(latestDataInterfaceUrl));


  const option = {

    title: {
        text: titleName,
    },
    xAxis: {
        type: 'category',
        position: 'bottom',
        data: timeArray,
    },
    yAxis: {
        type: 'value',
        position: 'left',
        min: 'dataMin',
        max: 'dataMax',
        axisLabel: { formatter: formatterStr },
    },
    legend: {
        orient: 'horizontal',
        x: 'center',
        y: 'top',
    },
    tooltip: {
        trigger: 'axis',
    },
    series: seriesData,
  };

  // 使用刚指定的配置项和数据显示图表。
  myChart.setOption(option);

  // 如果设置了最新数据的网址，且返回有数据，则实时更新
  if (latestDataInterfaceUrl.length) {
    setInterval(function () {
      const dataDictCur = LoadAndHandleData(latestDataInterfaceUrl);
      if (JSON.stringify(dataDictCur) !== '{}') {
        if (timeArray == null) {
          SetSeriesData(dataDictCur);
        } else {
          if (timeArray.length < dataDictCur.timeArray.length) {
            timeArray = dataDictCur.timeArray;
          }
          seriesData[seriesData.length - 1] = {
            type: 'line',
            data: dataDictCur.valuesArray[0],
            name: dataDictCur.dateColumn[0],
          };
        }
      }

      myChart.setOption({
        xAxis: {
          data: timeArray,
        },
          series: seriesData,
      });
    }, refreshInterval);
  }
}

export default echartsDynamicLineChart;
