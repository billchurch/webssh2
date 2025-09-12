import impl from './connectionHandler.impl.js';
export default function handleConnection(req, res, opts) {
    return impl(req, res, opts);
}
