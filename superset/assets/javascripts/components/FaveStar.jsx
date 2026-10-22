import React, { useLayoutEffect } from 'react';
import PropTypes from 'prop-types';
import cx from 'classnames';
import TooltipWrapper from './TooltipWrapper';
import { t } from '../locales';

const propTypes = {
  itemId: PropTypes.number.isRequired,
  fetchFaveStar: PropTypes.func,
  saveFaveStar: PropTypes.func,
  isStarred: PropTypes.bool.isRequired,
};

function FaveStar({ itemId, fetchFaveStar, saveFaveStar, isStarred }) {
  useLayoutEffect(() => {
    fetchFaveStar(itemId);
  }, [fetchFaveStar, itemId]);
  const onClick = e => {
    e.preventDefault();
    saveFaveStar(itemId, isStarred);
  };
    const iconClassNames = cx('fa', {
      'fa-star': isStarred,
      'fa-star-o': !isStarred
    });
    return <TooltipWrapper label="fave-unfave" tooltip={t('Click to favorite/unfavorite')}>
        <a href="#" onClick={onClick} className="fave-unfave-icon">
          <i className={iconClassNames} />
        </a>
      </TooltipWrapper>;
}
export default FaveStar;

FaveStar.propTypes = propTypes;
