// 'use strict';

export default {
    component: {
        width: '100%',
        display: 'inline-block',
        verticalAlign: 'top',
        paddingTop: '6px',
        overflowY: 'auto',
    },
    searchBox: {
        // padding: '20px 20px 0 20px'
        marginTop: '10px',
    },
    viewer: {
        base: {
            fontSize: '12px',
            whiteSpace: 'pre-wrap',
            // backgroundColor: '#282C34',
            backgroundColor: '#2255ba',
            border: 'solid 1px black',
            padding: '20px',
            color: '#9DA5AB',
            minHeight: '250px'
        }
    },
    treebeard_tree: {
        tree: {
            base: {
                listStyle: 'none',
                // backgroundColor: '#dc1863',
                margin: 0,
                padding: 0,
                // color: '#9DA5AB',
                fontFamily: 'lucida grande ,tahoma,verdana,arial,sans-serif',
                fontSize: '14px'
            },
            node: {
                base: {
                    position: 'relative'
                },
                link: {
                    cursor: 'pointer',
                    position: 'relative',
                    padding: '0px 5px',
                    display: 'block'
                },
                activeLink: {
                    background: '#ebedef'
                },
                toggle: {
                    base: {
                        position: 'relative',
                        display: 'inline-block',
                        verticalAlign: 'top',
                        marginLeft: '-5px',
                        height: '24px',
                        width: '24px'
                    },
                    wrapper: {
                        position: 'absolute',
                        top: '50%',
                        left: '50%',
                        margin: '-7px 0 0 -7px',
                        height: '14px'
                    },
                    height: 12,
                    width: 12,
                    arrow: {
                        fill: '#9DA5AB',
                        strokeWidth: 0
                    }
                },
                header: {
                    base: {
                        display: 'inline-block',
                        verticalAlign: 'top',
                        // color: '#dc1863'
                    },
                    connector: {
                        width: '2px',
                        height: '12px',
                        borderLeft: 'solid 2px black',
                        borderBottom: 'solid 2px black',
                        position: 'absolute',
                        top: '0px',
                        left: '-21px'
                    },
                    title: {
                        lineHeight: '24px',
                        verticalAlign: 'middle'
                    }
                },
                subtree: {
                    listStyle: 'none',
                    paddingLeft: '19px'
                },
                loading: {
                    color: '#E2C089'
                }
            }
        }

    }
};
