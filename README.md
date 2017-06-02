# Client-side Component Model (_ccm_)

## What is _ccm_?
The “Client-side Component Model” (_ccm_) is a model for running web components inside the browser and is consists of a _ccm_ framework and _ccm_ components. _ccm_ uses two features of the W3C web components standard: Custom Elements and Shadow DOM.

## What is the _ccm_ Framework?
The _ccm_ framework provides two services, one for embedding _ccm_ components inside any web-based content and the other service for data management. It is a tiny JavaScript file (24kB minified, 9kB zipped) and uses native JavaScript only and has no dependency to other resources or frameworks. The _ccm_ framework is published as free software under MIT licence (see https://github.com/akless/ccm). It is loaded automatically when a _ccm_ component is used.

## What is a _ccm_ Component?
A _ccm_ component is a tiny JavaScript file which works with native HTML, CSS and JavaScript based on the _ccm_ framework. It may be composed of other _ccm_ components and use other JavaScript frameworks. There are no restrictions in application domain. Every _ccm_ component is embeddable in every web-based content. Each _ccm_ component that is published as free software increases the functionality of the free web. 

## Which ccm Components already exists?
ccm components for quiz, fill-in-the-blank text, chat, team building, slidecast, commentary, rating, user input, user authentication, data logging and unit tests have already been developed. All these components are published as free software under MIT Licence.

## Where to find _ccm_ Components?
A market place has been developed as prototype where all published _ccm_ components are collected and informations about them presented. These informations contain basic data like author, licence, version and the public URL of the component JavaScript file.

## How to use a _ccm_ Component?
There are three different ways how to use a _ccm_ component:
Declarative via HTML Tag
Functional via JavaScript
Interactive via Bookmarklet

### Declarative via HTML Tag
This works in two steps. Firstly, the _ccm_ component must be loaded using a HTML <script> tag. That results in a new usable HTML tag which is an W3C Custom Element. Secondly, use this HTML tag at any place inside the web-based content for embedding. Use the component specific HTML attributes of the tag and the component specific inner HTML tags for setting up the configuration data. If the configuration data is stored in a database or a JSON file, it can be loaded directly from there with the _ccm_ specific HTML attribute “key”. The HTML tag then acts like an embed key.

### Functional via JavaScript
This works in two steps. Firstly, the _ccm_ framework must be loaded using a HTML <script> tag. Secondly, call the method of the _ccm_ framework for running a _ccm_ component. The method needs the URL of the _ccm_ component JavaScript file and the configuration data.

### Interactive via Bookmarklet
A bookmarklet is a browser bookmark enriched by JavaScript. Our _ccm_ market place provides a bookmarklet for each published component. Every web user can use such a bookmarklet on any web page to add a new draggable and resizable web page area with the embedded component in it.

## On-demand and Cross-domain Embedding of a _ccm_ Component
A _ccm_ component is embeddable on-demand and cross-domain inside any web-based content. On-demand means that a component is not only embeddable when a website is loading, it can also be included later. Cross-domain means that components must not be located on the same server where the actual website comes from, but it can be located on any other web server. With both aspects, any web user is able to embed a component in any currently viewed web page (see 2.2.6.3). The embedding of a _ccm_ component works without iFrame.

## _ccm_ Components are Recombinable
Like the Lego way, _ccm_ components are recombinable. This results in a dependency tree. For example the component for rendering a learning unit reuses the components for quiz and video and the video component reuses components for commentary and rating (see Figure 1). These dependencies are automatically solved recursively and asynchronously by the _ccm_ framework at runtime. The framework makes sure that all dependent resources are loaded in parallel and no resource is loaded twice. Any dependent resource and data can be loaded cross-domain.

## _ccm_ is Versioned and Backward Compatible
The _ccm_ framework and all _ccm_ components are versioned and use Semantic Versioning 2.0.0 (see http://semver.org). The same _ccm_ component can be embedded multiple times in the same web page and also different versions of a component without any conflicts and side effects. That is because each component and version has its own namespace inside a web page. It is also possible to use different versions of the _ccm_ framework in the same web page. This ensures backward compatibility.

## Providing of a _ccm_ Component as Mobile Web App
Each _ccm_ component can be provided as mobile web app in two steps:
Embed the component inside the HTML <body> tag of a blank web page.
Add the appropriate HTML <meta> tags to display the web page on mobile devices as native app.
Now a user can open the web page and  store it as mobile web app on the home screen of a mobile device.

## Service for Data Management
The _ccm_ framework provides a service for component developers for data management. It allows the usage of _ccm_ datastores. A _ccm_ datastore can manage datasets in one of three choosable data levels and can also be used autonomously of _ccm_ components for easy data management. The different data levels are described below. _ccm_ datastores are intended to be universal and provide a simple uniform API for basic CRUD operations to create, read, update and delete datasets.

### Data Level 1: Local Object
On the first level the data will be managed in an local object. Than all managed datasets are fugitive data which are gone by leaving the actual opened website.

### Data Level 2: Client-side Database
On the second level the data will be managed in a client-side database. Than all managed data is still there after page reload. This is specially interesting for offline functionality.

### Data Level 3: Server-side Database
On the third level the data will be managed in any server-side database of choice. The server must have an _ccm_ compatible interface. Than all managed datasets are stored persistently on a server and they are not bound to a specific client. Different network protocols are possible for communication between client and server. In case of realtime communication with Web Socket as network protocol for a _ccm_ datastore with data level 3, the server informs every active client about changing data sets. Then a _ccm_ component which uses such a datastore can react to this changes. That means mostly to update immediately content in the frontend.

## Cross-domain Realtime Communication
If _ccm_ components are using the same _ccm_ datastore with data level 3 and Websocket Protocol (see 2.2.11.3), than the components are able to exchange data in realtime. If the _ccm_ components are used in different domains or web-based platforms, this realtime communication is cross-domain.
