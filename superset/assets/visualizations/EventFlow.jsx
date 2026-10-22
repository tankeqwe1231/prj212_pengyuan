import React, { useMemo } from 'react';

import { renderReact } from '../javascripts/modules/reactRoot';
import { t } from '../javascripts/locales';

function EventFlow({ data, entityKey, eventKey }) {
  const entities = useMemo(() => {
    const groups = {};
    data.forEach((event) => {
      const key = String(event[entityKey]);
      if (!groups[key]) groups[key] = [];
      groups[key].push(event);
    });
    return Object.keys(groups).map(key => ({
      events: groups[key].sort((left, right) => new Date(left.__timestamp) - new Date(right.__timestamp)),
      key,
    }));
  }, [data, entityKey]);

  return (
    <div className="event-flow" style={{ height: '100%', overflow: 'auto' }}>
      {entities.map(entity => (
        <div className="event-flow-row" key={entity.key} style={{ borderBottom: '1px solid #eee', display: 'flex', padding: '8px' }}>
          <strong style={{ flex: '0 0 140px' }}>{entity.key}</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {entity.events.map((event, index) => (
              <span className="badge text-bg-info" key={`${event.__timestamp}-${index}`} title={new Date(event.__timestamp).toLocaleString()}>
                {event[eventKey]}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function renderEventFlow(slice, json) {
  const container = document.querySelector(slice.selector);
  const hasData = json.data && json.data.length > 0;
  renderReact(hasData ? (
    <EventFlow
      data={json.data}
      entityKey={json.form_data.entity}
      eventKey={json.form_data.all_columns_x}
    />
  ) : <div>{t('Sorry, there appears to be no data')}</div>, container);
}

export default renderEventFlow;
