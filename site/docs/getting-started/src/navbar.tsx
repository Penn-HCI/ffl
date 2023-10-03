
import { Divider } from '@mui/material';
import FFLLogo from './assets/logo.tsx';

type NavItem = { name: string, link: string };
type NavGroup = { name: string, items: NavItem[], collapseKey: string };
type Nav = (NavItem | NavGroup | string)[];

export const nav: Nav = [
    {
        name: 'Getting Started',
        items: [
            { name: 'Tutorial: Linear Regression', link: 'index.html' },
        ],
        collapseKey: 'getting-started'
    },
    {
        name: 'Selectors',
        items: [
            { name: 'Basic Selectors', link: 'basic-selectors.html' },
            { name: 'Combining Selectors', link: 'combining-selectors.html' },
            { name: 'Pseudo-Selectors', link: 'pseudo-selectors.html' },
        ],
        collapseKey: 'selectors'
    },
    {
        name: 'Style Properties',
        items: [
            { name: 'Basic Styles', link: 'basic-styles.html' },
            { name: 'Additional Styles', link: 'additional-styles.html' },
        ],
        collapseKey: 'styles'
    },
    // "divider",
    // {
    //     name: 'For Developers',
    //     items: [
    //         { name: 'Install', link: 'install.html' },
    //         { name: 'API', link: 'api.html' },
    //         { name: 'Example Integration', link: 'example-integration.html' },
    //         { name: 'Hacking Guide', link: 'hacking-guide.html' },
    //     ],
    //     collapseKey: 'developers'
    // },
];

function NavItem({ name, link }: { name: string, link: string }) {
    const filename = window.location.pathname.split("/").pop();
    return (<li key={name} >
        <a href={link} style={{ fontWeight: filename === link ? 'bold' : 'normal' }}
            className="link-body-emphasis d-inline-flex text-decoration-none rounded">{name}</a>
    </li>);
}

function NavGroup({ name, children, collapseKey }: { name: string, children: JSX.Element | JSX.Element[], collapseKey: string }) {
    return (<li className="mb-1" key={collapseKey}>
        <button className="btn btn-toggle d-inline-flex align-items-center rounded border-0"
            data-bs-toggle="collapse" data-bs-target={`#${collapseKey}-collapse`} aria-expanded="true">
            {name}
        </button>
        <div className="collapse show" id={`${collapseKey}-collapse`}>
            <ul className="btn-toggle-nav list-unstyled fw-normal pb-1 small">
                {children}
            </ul>
        </div>
    </li>);
}

function NavBarItem(item: NavItem | NavGroup | string) {
    if (item === 'divider') {
        return (<Divider sx={{ margin: '8pt' }} />);
    } else if ((item as NavGroup).items) {
        return (<NavGroup collapseKey={(item as NavGroup).collapseKey} name={(item as NavGroup).name}>
            {(item as NavGroup).items.map(item => (<NavItem name={item.name} link={item.link} key={item.name} />))}
        </NavGroup>);
    } else if ((item as NavItem).link) {
        return (<NavItem name={(item as NavItem).name} link={(item as NavItem).link} key={(item as NavItem).name} />);
    }
}

export function NavBar({ nav }: { nav: Nav }) {
    return (<div style={{ height: '100vh', overflowY: 'auto' }}>
        <ul className="list-unstyled ps-0 d-flex flex-column fw-normal pb-1">
            <a href="/ffl" key="title"
                className="d-flex align-items-center pb-3 mb-3 link-body-emphasis text-decoration-none border-bottom">
                <FFLLogo />
                <span className="fs-5 fw-semibold" style={{ marginRight: '2ex' }}>Tutorial & Docs</span>
            </a>
            {nav.map(NavBarItem)}
        </ul>
    </div >);
}