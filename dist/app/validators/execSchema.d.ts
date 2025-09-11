export namespace execSchema {
    export let type: string;
    export namespace properties {
        namespace command {
            let type_1: string;
            export { type_1 as type };
            export let minLength: number;
        }
        namespace pty {
            let type_2: string;
            export { type_2 as type };
            export let nullable: boolean;
        }
        namespace term {
            let type_3: string;
            export { type_3 as type };
            let nullable_1: boolean;
            export { nullable_1 as nullable };
        }
        namespace cols {
            let type_4: string;
            export { type_4 as type };
            export let minimum: number;
            let nullable_2: boolean;
            export { nullable_2 as nullable };
        }
        namespace rows {
            let type_5: string;
            export { type_5 as type };
            let minimum_1: number;
            export { minimum_1 as minimum };
            let nullable_3: boolean;
            export { nullable_3 as nullable };
        }
        namespace env {
            let type_6: string;
            export { type_6 as type };
            let nullable_4: boolean;
            export { nullable_4 as nullable };
            export namespace additionalProperties {
                let type_7: string;
                export { type_7 as type };
            }
        }
        namespace timeoutMs {
            let type_8: string;
            export { type_8 as type };
            let minimum_2: number;
            export { minimum_2 as minimum };
            let nullable_5: boolean;
            export { nullable_5 as nullable };
        }
    }
    export let required: string[];
    let additionalProperties_1: boolean;
    export { additionalProperties_1 as additionalProperties };
}
