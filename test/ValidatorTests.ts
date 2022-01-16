var assert:Chai.Assert = require('chai').assert;
var should:Chai.Should = require('chai').should();
var expect:Chai.ExpectStatic = require('chai').expect;
import { Validator } from './../api/library/validation/Validator';
describe('ValidatorTests',function(){
    
    
    it('required valid test',async function(){
        var body = {
            "id":"5345345345345",
            "client": {
                "id": "werwer",
                "name": "ertert"
            },
            "items": [
                {
                    "foo": "bar"
                }
            ]
        };
        var validator = new Validator(body);
        validator.validateRequired("id");
        validator.validateRequired("client.name");
        validator.validateRequired("items[].foo");
        var result = await validator.validate();

        //testing TTD assert
        assert.isTrue(validator.success);
    });
    
    it('required invalid test',async function(){
        var body = {
            "id":null,
            "client": {
                "id": null,
                "name": null                
            },
            "items": [
                {
                    "foo": null
                }
            ]
        };
        var validator = new Validator(body);
        validator.validateRequired("id");
        validator.validateRequired("client.id");
        validator.validateRequired("client.name");
        validator.validateRequired("items[].foo");
        var result = await validator.validate();

        //testing TTD assert
        assert.isFalse(validator.success);
        result.should.have.property("id");
        result.should.have.nested.property("client.id").and.equal('required');
        result.should.have.nested.property("client.name").and.equal('required');
        result.should.have.nested.property("items[0].foo").and.equal('required');
    });

    it('min length valid test',async function() {
        var body = {
            "id": "test",
            "items": [
                {
                    "id": "test"
                },
                {
                    "id": "test"
                },
                {
                    "id": "test"
                }
            ],
            "child": {
                "id": "test"
            }
        };
        var validator = new Validator(body);
        validator.validateMinLength("id",4);
        validator.validateMinLength("items",3);
        validator.validateMinLength("items[].id",4);
        validator.validateMinLength("child.id",4);
        var result = await validator.validate();
        assert.isTrue(validator.success);
    });
    
    it('min length invalid test',async function() {
        var body = {
            "id": "test",
            "items": [
                {
                    "id": "test"
                },
                {
                    "id": "test"
                },
                {
                    "id": "test"
                }
            ],
            "more_items": [
                1,2,3
            ],
            "child": {
                "id": "test"
            }
        };
        var validator = new Validator(body);
        validator.validateMinLength("id",5);
        validator.validateMinLength("more_items",4);
        validator.validateMinLength("items[].id",5);
        validator.validateMinLength("child.id",5);
        var result = await validator.validate();
        //console.log(result);
        assert.isFalse(validator.success);
        result.should.have.property("id").and.equal("minimum length: 5");
        result.should.have.property("more_items").and.equal("minimum length: 4");
        result.should.have.nested.property("child.id").and.equal("minimum length: 5");
        result.should.have.nested.property("items[0].id").and.equal("minimum length: 5");
        result.should.have.nested.property("items[1].id").and.equal("minimum length: 5");
        result.should.have.nested.property("items[2].id").and.equal("minimum length: 5");
    });
})