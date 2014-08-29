
    $(document).ready () ->
        graph = new Graph
            el: $('#surface svg')
        console.log graph

    class Graph extends Avispa
        initialize: () ->
            super

            console.log 'init'
