export default configSchema;
declare namespace configSchema {
    export let type: string;
    export namespace properties {
        namespace listen {
            let type_1: string;
            export { type_1 as type };
            export namespace properties_1 {
                namespace ip {
                    let type_2: string;
                    export { type_2 as type };
                    export let format: string;
                }
                namespace port {
                    let type_3: string;
                    export { type_3 as type };
                    export let minimum: number;
                    export let maximum: number;
                }
            }
            export { properties_1 as properties };
            export let required: string[];
        }
        namespace http {
            let type_4: string;
            export { type_4 as type };
            export namespace properties_2 {
                namespace origins {
                    let type_5: string;
                    export { type_5 as type };
                    export namespace items {
                        let type_6: string;
                        export { type_6 as type };
                    }
                }
            }
            export { properties_2 as properties };
            let required_1: string[];
            export { required_1 as required };
        }
        namespace user {
            let type_7: string;
            export { type_7 as type };
            export namespace properties_3 {
                namespace name {
                    let type_8: string[];
                    export { type_8 as type };
                }
                namespace password {
                    let type_9: string[];
                    export { type_9 as type };
                }
                namespace privateKey {
                    let type_10: string[];
                    export { type_10 as type };
                }
                namespace passphrase {
                    let type_11: string[];
                    export { type_11 as type };
                }
            }
            export { properties_3 as properties };
            let required_2: string[];
            export { required_2 as required };
        }
        namespace ssh {
            let type_12: string;
            export { type_12 as type };
            export namespace properties_4 {
                export namespace host {
                    let type_13: string[];
                    export { type_13 as type };
                }
                export namespace port_1 {
                    let type_14: string;
                    export { type_14 as type };
                    let minimum_1: number;
                    export { minimum_1 as minimum };
                    let maximum_1: number;
                    export { maximum_1 as maximum };
                }
                export { port_1 as port };
                export namespace term {
                    let type_15: string;
                    export { type_15 as type };
                }
                export namespace readyTimeout {
                    let type_16: string;
                    export { type_16 as type };
                }
                export namespace keepaliveInterval {
                    let type_17: string;
                    export { type_17 as type };
                }
                export namespace keepaliveCountMax {
                    let type_18: string;
                    export { type_18 as type };
                }
                export namespace algorithms {
                    let type_19: string;
                    export { type_19 as type };
                    export namespace properties_5 {
                        namespace kex {
                            let type_20: string;
                            export { type_20 as type };
                            export namespace items_1 {
                                let type_21: string;
                                export { type_21 as type };
                            }
                            export { items_1 as items };
                        }
                        namespace cipher {
                            let type_22: string;
                            export { type_22 as type };
                            export namespace items_2 {
                                let type_23: string;
                                export { type_23 as type };
                            }
                            export { items_2 as items };
                        }
                        namespace hmac {
                            let type_24: string;
                            export { type_24 as type };
                            export namespace items_3 {
                                let type_25: string;
                                export { type_25 as type };
                            }
                            export { items_3 as items };
                        }
                        namespace serverHostKey {
                            let type_26: string;
                            export { type_26 as type };
                            export namespace items_4 {
                                let type_27: string;
                                export { type_27 as type };
                            }
                            export { items_4 as items };
                        }
                        namespace compress {
                            let type_28: string;
                            export { type_28 as type };
                            export namespace items_5 {
                                let type_29: string;
                                export { type_29 as type };
                            }
                            export { items_5 as items };
                        }
                    }
                    export { properties_5 as properties };
                    let required_3: string[];
                    export { required_3 as required };
                }
            }
            export { properties_4 as properties };
            let required_4: string[];
            export { required_4 as required };
        }
        namespace header {
            let type_30: string;
            export { type_30 as type };
            export namespace properties_6 {
                namespace text {
                    let type_31: string[];
                    export { type_31 as type };
                }
                namespace background {
                    let type_32: string;
                    export { type_32 as type };
                }
            }
            export { properties_6 as properties };
            let required_5: string[];
            export { required_5 as required };
        }
        namespace options {
            let type_33: string;
            export { type_33 as type };
            export namespace properties_7 {
                namespace challengeButton {
                    let type_34: string;
                    export { type_34 as type };
                }
                namespace autoLog {
                    let type_35: string;
                    export { type_35 as type };
                }
                namespace allowReauth {
                    let type_36: string;
                    export { type_36 as type };
                }
                namespace allowReconnect {
                    let type_37: string;
                    export { type_37 as type };
                }
                namespace allowReplay {
                    let type_38: string;
                    export { type_38 as type };
                }
            }
            export { properties_7 as properties };
            let required_6: string[];
            export { required_6 as required };
        }
        namespace session {
            let type_39: string;
            export { type_39 as type };
            export namespace properties_8 {
                export namespace secret {
                    let type_40: string;
                    export { type_40 as type };
                }
                export namespace name_1 {
                    let type_41: string;
                    export { type_41 as type };
                }
                export { name_1 as name };
            }
            export { properties_8 as properties };
            let required_7: string[];
            export { required_7 as required };
        }
    }
    let required_8: string[];
    export { required_8 as required };
}
