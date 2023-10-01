import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { RouterProvider, createBrowserRouter } from 'react-router-dom';
ReactDOM.createRoot(document.getElementById('root')).render(<React.StrictMode>
    <RouterProvider router={createBrowserRouter([
        {
            path: "/",
            element: <App />,
        },
    ], { basename: '/ffl/demo-dev' })}/>
  </React.StrictMode>);
//# sourceMappingURL=main.js.map